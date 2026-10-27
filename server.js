import express from "express";
import dotenv from "dotenv";
import OpenAI from "openai";
import ExcelJS from "exceljs";
import path from "path";
import { fileURLToPath } from "url";
import { LECTORLAB_PROMPT } from "./lectorlab-prompt.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const MODEL = process.env.OPENAI_MODEL || "gpt-5.6-luna";
const MAX_TURNS = 5;

if (!process.env.OPENAI_API_KEY) {
  console.warn("⚠️ Falta OPENAI_API_KEY. Copia .env.example como .env y agrega tu clave.");
}

const client = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

app.disable("x-powered-by");
app.use(express.json({ limit: "32kb" }));
app.use(express.static(path.join(__dirname, "public")));

// Límite sencillo para evitar abuso accidental de una API pública.
// Es deliberadamente amplio para permitir que un aula comparta la misma red.
const requestLog = new Map();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 300;

function rateLimit(req, res, next) {
  const now = Date.now();
  const key = req.ip || "unknown";
  const recent = (requestLog.get(key) || []).filter((t) => now - t < WINDOW_MS);

  if (recent.length >= MAX_REQUESTS_PER_WINDOW) {
    return res.status(429).json({ error: "Hay demasiadas solicitudes en este momento. Intenta nuevamente en unos minutos." });
  }

  recent.push(now);
  requestLog.set(key, recent);
  next();
}

function cleanHistory(history) {
  if (!Array.isArray(history)) return [];

  return history
    .slice(-10)
    .filter((item) => item && ["user", "assistant"].includes(item.role) && typeof item.content === "string")
    .map((item) => ({
      role: item.role,
      content: item.content.trim().slice(0, 500),
    }))
    .filter((item) => item.content.length > 0);
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, model: MODEL, maxTurns: MAX_TURNS });
});

app.post("/api/lectorlab", rateLimit, async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({ error: "LectorLab todavía no tiene configurada su clave de API." });
    }

    const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
    const turn = Number(req.body?.turn);
    const history = cleanHistory(req.body?.history);

    if (!message) {
      return res.status(400).json({ error: "Escribe una idea antes de enviarla." });
    }

    if (message.length > 500) {
      return res.status(400).json({ error: "Tu intervención es demasiado extensa. Resume tu idea en menos de 500 caracteres." });
    }

    if (!Number.isInteger(turn) || turn < 1 || turn > MAX_TURNS) {
      return res.status(400).json({ error: "La conversación ya alcanzó el máximo de 5 intervenciones." });
    }

    const dynamicInstructions = `${LECTORLAB_PROMPT}\n\nCONTEXTO DE ESTE TURNO\nEsta es la intervención ${turn} de ${MAX_TURNS} del estudiante. ${
      turn === MAX_TURNS
        ? "Debes cerrar el diálogo con un reto metacognitivo breve que el estudiante pueda llevar a la evaluación final; no formules una pregunta que necesite una sexta intervención en el chat."
        : "Formula una única pregunta socrática que haga avanzar su razonamiento."
    }`;

    const response = await client.responses.create({
      model: MODEL,
      instructions: dynamicInstructions,
      input: [...history, { role: "user", content: message }],
      reasoning: { effort: "none" },
      max_output_tokens: 300,
    });

    const reply = (response.output_text || "").trim();

    if (!reply) {
      return res.status(502).json({ error: "LectorLab no pudo generar una pregunta. Intenta nuevamente." });
    }

    res.json({
      reply: reply.slice(0, 650),
      turn,
      remaining: MAX_TURNS - turn,
    });
  } catch (error) {
    console.error("Error en LectorLab:", error?.message || error);

    const status = error?.status === 429 ? 429 : 500;
    const message =
      status === 429
        ? "El servicio de IA está recibiendo muchas solicitudes. Intenta nuevamente en un momento."
        : "No se pudo conectar con LectorLab. Revisa la configuración del servidor e inténtalo otra vez.";

    res.status(status).json({ error: message });
  }
});


// Genera un Excel al momento. No guarda respuestas ni crea una base de datos.
app.post("/api/export-xlsx", async (req, res) => {
  try {
    const data = req.body || {};
    const objective = Array.isArray(data.objectiveResponses) ? data.objectiveResponses.slice(0, 12) : [];
    const chat = Array.isArray(data.chat) ? data.chat.slice(0, 5) : [];

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "LectorLab";
    workbook.company = "RED Más allá de las palabras";
    workbook.created = new Date();
    workbook.modified = new Date();

    const palette = {
      wine: "6D3045",
      gold: "C8974C",
      blue: "446D87",
      sage: "4F786B",
      ink: "1F2530",
      light: "F8F4EC",
      soft: "F4ECE5",
      white: "FFFFFF",
      green: "2F7654",
      red: "9B4141",
      line: "DED7CF",
    };

    function title(sheet, text, subtitle) {
      sheet.mergeCells("A1:D1");
      const c = sheet.getCell("A1");
      c.value = text;
      c.font = { name: "Calibri", size: 18, bold: true, color: { argb: palette.white } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: palette.wine } };
      c.alignment = { vertical: "middle", horizontal: "left" };
      sheet.getRow(1).height = 31;

      if (subtitle) {
        sheet.mergeCells("A2:D2");
        const s = sheet.getCell("A2");
        s.value = subtitle;
        s.font = { italic: true, color: { argb: "6B7280" } };
        s.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FBF7F1" } };
        s.alignment = { wrapText: true, vertical: "middle" };
        sheet.getRow(2).height = 28;
      }
    }

    function header(row) {
      row.font = { bold: true, color: { argb: palette.white } };
      row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: palette.blue } };
      row.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      row.height = 24;
    }

    function borderRows(sheet, fromRow, toRow, cols = 4) {
      for (let r = fromRow; r <= toRow; r++) {
        for (let c = 1; c <= cols; c++) {
          const cell = sheet.getCell(r, c);
          cell.border = {
            top: { style: "thin", color: { argb: palette.line } },
            left: { style: "thin", color: { argb: palette.line } },
            bottom: { style: "thin", color: { argb: palette.line } },
            right: { style: "thin", color: { argb: palette.line } },
          };
          cell.alignment = { vertical: "top", wrapText: true };
        }
      }
    }

    // Hoja 1: resumen
    const summary = workbook.addWorksheet("Resumen", { views: [{ state: "frozen", ySplit: 3 }] });
    summary.columns = [
      { key: "campo", width: 29 },
      { key: "valor", width: 48 },
      { key: "campo2", width: 24 },
      { key: "valor2", width: 30 },
    ];
    title(summary, "Más allá de las palabras", "Reporte individual del recorrido de lectura crítica");
    summary.addRow([]);
    summary.addRow(["Dato", "Resultado", "Dato", "Resultado"]); header(summary.getRow(4));
    summary.addRow(["Texto base", data.textBase || "El almohadón de pluma", "Duración objetivo", "20 minutos"]);
    summary.addRow(["Puntaje formativo", `${Number(data.score || 0)}/${Number(data.maxScore || 9)}`, "Nivel", data.levelFormal || "—"]);
    summary.addRow(["Mérito lector", data.levelTitle || "—", "Aciertos objetivos", `${Number(data.objectiveScore || 0)}/6`]);
    summary.addRow(["Inicio del recorrido", data.startedAt || "—", "Finalización", data.completedAt || "—"]);
    summary.addRow(["Intervenciones con LectorLab", chat.length, "Uso", "Formativo, no calificación definitiva"]);
    borderRows(summary, 4, 9, 4);
    summary.getRow(6).font = { bold: true, color: { argb: palette.wine } };
    summary.autoFilter = "A4:D9";

    // Hoja 2: respuestas
    const answers = workbook.addWorksheet("Respuestas", { views: [{ state: "frozen", ySplit: 4 }] });
    answers.columns = [
      { header: "Sección", key: "section", width: 23 },
      { header: "Ítem", key: "item", width: 34 },
      { header: "Respuesta del estudiante", key: "answer", width: 68 },
      { header: "Resultado", key: "result", width: 20 },
    ];
    title(answers, "Respuestas del estudiante", "Las preguntas objetivas registran únicamente el primer intento.");
    answers.getRow(3).values = ["Sección", "Ítem", "Respuesta del estudiante", "Resultado"]; header(answers.getRow(3));

    const rows = [];
    rows.push(["Activación", "Respuesta inicial", data.initial || "—", "Respuesta abierta"]);
    objective.forEach((q, i) => {
      rows.push([q.section || "Preguntas", `Pregunta ${i + 1}`, q.response || "Sin respuesta", q.correct ? "Acierto" : "Por revisar"]);
    });
    rows.push(["Inferencia", "Hipótesis inicial", data.hypothesis || "—", "Respuesta abierta"]);
    rows.push(["Evaluación final", "Interpretación", data.posture || "—", data.criteria?.postureOK ? "Cumple criterio básico" : "Por desarrollar"]);
    rows.push(["Evaluación final", "Evidencia 1", data.evidence1 || "—", "Evidencia textual"]);
    rows.push(["Evaluación final", "Evidencia 2", data.evidence2 || "—", "Evidencia textual"]);
    rows.push(["Evaluación final", "Reflexión sobre el cambio", data.reflection || "—", data.criteria?.reflectionOK ? "Cumple criterio básico" : "Por desarrollar"]);
    rows.push(["Cierre", "Reflexión final", data.finalThought || "—", "Metacognición"]);
    rows.forEach(r => answers.addRow(r));
    borderRows(answers, 3, 3 + rows.length, 4);
    for (let r = 4; r <= 3 + rows.length; r++) {
      const result = String(answers.getCell(r, 4).value || "");
      if (result === "Acierto" || result === "Cumple criterio básico") {
        answers.getCell(r, 4).font = { color: { argb: palette.green }, bold: true };
      } else if (result === "Por revisar" || result === "Por desarrollar") {
        answers.getCell(r, 4).font = { color: { argb: palette.red }, bold: true };
      }
    }
    answers.autoFilter = `A3:D${3 + rows.length}`;

    // Hoja 3: diálogo con IA
    const chatSheet = workbook.addWorksheet("LectorLab", { views: [{ state: "frozen", ySplit: 4 }] });
    chatSheet.columns = [
      { header: "Turno", key: "turn", width: 10 },
      { header: "Estudiante", key: "student", width: 62 },
      { header: "LectorLab", key: "bot", width: 72 },
      { header: "Propósito", key: "purpose", width: 26 },
    ];
    title(chatSheet, "Conversación con LectorLab", "Tutor socrático: pide evidencias, cuestiona inferencias y evita dar la respuesta final.");
    chatSheet.getRow(3).values = ["Turno", "Estudiante", "LectorLab", "Propósito"]; header(chatSheet.getRow(3));
    chat.forEach((t, i) => {
      chatSheet.addRow([
        i + 1,
        t.student || "—",
        t.lectorlab || "—",
        i === chat.length - 1 && chat.length >= 5 ? "Cierre metacognitivo" : "Profundización socrática",
      ]);
    });
    if (!chat.length) chatSheet.addRow(["—", "Sin conversación registrada", "—", "—"]);
    borderRows(chatSheet, 3, Math.max(4, 3 + chat.length), 4);

    [summary, answers, chatSheet].forEach((sheet) => {
      sheet.properties.defaultRowHeight = 19;
      sheet.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
      sheet.headerFooter.oddFooter = "LectorLab · RED Más allá de las palabras";
    });

    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="respuestas_RED_lectura_critica.xlsx"');
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error("Error exportando Excel:", error?.message || error);
    res.status(500).json({ error: "No se pudo generar el archivo Excel. Intenta nuevamente." });
  }
});

app.listen(PORT, () => {
  console.log(`\n📚 LectorLab listo en http://localhost:${PORT}`);
  console.log(`🤖 Modelo: ${MODEL}`);
  console.log("🔐 La clave de API permanece en el servidor.\n");
});
