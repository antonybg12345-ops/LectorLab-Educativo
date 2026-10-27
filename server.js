import dotenv from "dotenv";
import { createApp } from "./src/app.js";
import { readConfig } from "./src/config.js";
import { createOpenAITutor } from "./src/ai/openai.js";

dotenv.config();
const config = readConfig();
const tutor = createOpenAITutor({ apiKey: process.env.OPENAI_API_KEY, model: config.model });
if (!tutor) console.warn("Falta OPENAI_API_KEY; lectura y Excel funcionan sin IA.");

const server = createApp({ config, tutor }).listen(config.port, config.host, () => {
  console.log(`LectorLab local iniciado en ${config.host}:${server.address().port}`);
  console.log("Demostración local: sin cuentas, persistencia ni resultados académicos verificados.");
});
server.on("error", () => {
  console.error("No se pudo iniciar el servidor. Revisa HOST, PORT y si el puerto está ocupado.");
  process.exitCode = 1;
});
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    server.close(() => process.exit(0));
    server.closeIdleConnections();
    setTimeout(() => process.exit(1), 5000).unref();
  });
}
