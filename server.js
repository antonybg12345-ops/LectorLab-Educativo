import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { openDatabase } from './src/platform/db.js';
import { createPlatformApp } from './src/platform/app.js';
import { createSheetsClient } from './src/platform/sheets.js';
import { createQuestionGenerator } from './src/platform/generation.js';
import { createOpenAITutor } from './src/ai/openai.js';
import OpenAI from 'openai';

dotenv.config();
let database;
async function start() {
  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || '127.0.0.1';
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Puerto inválido');
  database = await openDatabase({
    databaseUrl: process.env.DATABASE_URL || undefined,
    dataDir: process.env.LECTORLAB_DATA_DIR || fileURLToPath(new URL('./.data/postgres', import.meta.url)),
  });
  // Only the embedded single-process preview owns all in-flight operations.
  // External deployment needs worker leases before enabling multi-instance serving.
  if (database.kind === 'pglite') await database.query("UPDATE tutor_turns SET state='unknown' WHERE state='pending'");
  const key = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL;
  const aiEnabled = Boolean(key && model);
  const client = aiEnabled ? new OpenAI({ apiKey: key, timeout: 25_000, maxRetries: 0 }) : null;
  const app = await createPlatformApp({ db: database,
    tutor: aiEnabled ? createOpenAITutor({ client, model }) : null,
    generator: aiEnabled ? createQuestionGenerator({ client, model }) : null,
    allowSetup: ['127.0.0.1', 'localhost', '::1'].includes(host) && process.env.ALLOW_INITIAL_SETUP !== 'false',
    secureCookies: process.env.NODE_ENV === 'production', trustProxy: process.env.TRUST_PROXY === '1',
    sheets: createSheetsClient({ credentialsFile: process.env.LECTORLAB_GOOGLE_CREDENTIALS_FILE }),
  });
  const server = app.listen(port, host, error => {
    if (error || !server.address()) return; // Express 5 invokes this callback on bind errors too.
    console.log(`LectorLab 2.0 — primera versión en ${host}:${server.address().port}`);
    console.log('Crea tu primer acceso docente desde la pantalla inicial. No hay contraseñas predeterminadas.');
    console.log(aiEnabled ? 'IA configurada; conexión real no verificada.' : 'IA no configurada: actividades manuales, guía de lectura y Excel disponibles.');
    console.log('Vista previa para pruebas con datos ficticios; revisar privacidad y operación antes de uso institucional.');
  });
  server.on('error', async () => {
    console.error('No se pudo abrir el puerto. Revisa HOST, PORT y si otra instancia sigue activa.');
    await database.close(); process.exitCode = 1;
  });
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
    server.close(async () => { await database.close(); process.exit(0); });
    server.closeIdleConnections();
    setTimeout(() => process.exit(1), 8000).unref();
  });
}
start().catch(async () => {
  console.error('No se pudo iniciar LectorLab. Comprueba la versión de Node, la carpeta privada de datos y la conexión PostgreSQL si la configuraste. No se mostraron credenciales.');
  await database?.close(); process.exitCode = 1;
});
