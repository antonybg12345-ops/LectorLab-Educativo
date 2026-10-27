import express from "express";
import { fileURLToPath } from "node:url";
import { LECTORLAB_PROMPT } from "../lectorlab-prompt.js";
import { evaluateSubmission } from "../public/js/assessment.js";
import { readConfig } from "./config.js";
import { InputError, validateSubmission, validateTutor } from "./validation.js";
import { buildWorkbook } from "./reports/workbook.js";

const publicDirectory = fileURLToPath(new URL("../public/", import.meta.url));

/** No .env loading, listener or external request while constructing/importing this app. */
export function createApp({ config = {}, tutor = null, exportWorkbook = buildWorkbook, logger = console, clock = Date.now } = {}) {
  const settings = { ...readConfig({}), ...config };
  const app = express();
  const requestLog = new Map();
  app.disable("x-powered-by");
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    next();
  });
  app.use(express.json({ limit: settings.jsonLimit }));
  app.use(express.static(publicDirectory));

  // Local-only abuse protection. IP is not identity; it may be a shared classroom.
  // On-demand pruning avoids import timers and bounds memory.
  function rateLimit(req, res, next) {
    const now = clock();
    for (const [key, times] of requestLog) {
      const recent = times.filter((time) => now - time < settings.rateWindowMs);
      if (recent.length) requestLog.set(key, recent);
      else requestLog.delete(key);
    }
    const key = req.ip || "unknown";
    const recent = requestLog.get(key) || [];
    if (recent.length >= settings.rateMaxRequests) {
      res.setHeader("Retry-After", Math.ceil(settings.rateWindowMs / 1000));
      return res.status(429).json({ error: "Hay demasiadas solicitudes. Intenta nuevamente en unos minutos." });
    }
    if (!requestLog.has(key) && requestLog.size >= 1000) requestLog.delete(requestLog.keys().next().value);
    recent.push(now);
    requestLog.set(key, recent);
    next();
  }

  app.get("/api/health", (_req, res) => res.json({ ok: true, model: settings.model, maxTurns: settings.maxTurns,
    ai: { configured: typeof tutor === "function", verified: false }, mode: "local-unverified" }));

  app.post("/api/lectorlab", rateLimit, async (req, res, next) => {
    try {
      const { message, turn, history } = validateTutor(req.body, settings.maxTurns);
      if (typeof tutor !== "function") return res.status(503).json({ error: "LectorLab todavía no tiene configurada su clave de API." });
      const instructions = `${LECTORLAB_PROMPT}\n\nCONTEXTO DE ESTE TURNO\nEsta es la intervención ${turn} de ${settings.maxTurns} del estudiante. ${
        turn === settings.maxTurns
          ? "Debes cerrar el diálogo con un reto metacognitivo breve que el estudiante pueda llevar a la evaluación final; no formules una pregunta que necesite una sexta intervención en el chat."
          : "Formula una única pregunta socrática que haga avanzar su razonamiento."
      }`;
      let reply;
      try { reply = await tutor({ model: settings.model, instructions, message, turn, history }); }
      catch (error) {
        logger.error?.("Fallo del proveedor IA", { status: error?.status === 429 ? 429 : 500 });
        const status = error?.status === 429 ? 429 : 500;
        return res.status(status).json({ error: status === 429
          ? "El servicio de IA está recibiendo muchas solicitudes. Intenta nuevamente en un momento."
          : "No se pudo conectar con LectorLab. Inténtalo otra vez." });
      }
      if (typeof reply !== "string" || !reply.trim()) return res.status(502).json({ error: "LectorLab no pudo generar una pregunta. Intenta nuevamente." });
      res.json({ reply: reply.trim().slice(0, 650), turn, remaining: settings.maxTurns - turn });
    } catch (error) { next(error); }
  });

  app.post("/api/export-xlsx", rateLimit, async (req, res, next) => {
    try {
      const submission = validateSubmission(req.body);
      const result = evaluateSubmission(submission);
      const buffer = await exportWorkbook({ submission, result, generatedAt: new Date(clock()) });
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", 'attachment; filename="respuestas_RED_lectura_critica.xlsx"');
      res.send(Buffer.from(buffer));
    } catch (error) { next(error); }
  });

  app.use("/api", (_req, res) => res.status(404).json({ error: "Ruta de API no encontrada." }));
  app.use((error, _req, res, _next) => {
    if (error instanceof InputError) return res.status(400).json({ error: error.message });
    if (error.type === "entity.too.large") return res.status(413).json({ error: "La solicitud excede el tamaño permitido." });
    if (error.type === "entity.parse.failed") return res.status(400).json({ error: "El cuerpo JSON no es válido." });
    logger.error?.("Fallo interno de LectorLab", { status: 500 });
    res.status(500).json({ error: "No se pudo completar la solicitud. Inténtalo nuevamente." });
  });
  return app;
}
