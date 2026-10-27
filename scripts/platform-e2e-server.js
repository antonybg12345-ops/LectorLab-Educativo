// Test-only in-memory PostgreSQL and injected providers. Never reads a real key.
// This file must not be used as the public/production entry point.
import { openDatabase } from '../src/platform/db.js';
import { createPlatformApp } from '../src/platform/app.js';

const db = await openDatabase({ dataDir: 'memory://' });
const tutor = async () => '¿Qué fragmento respalda tu idea y cómo se relaciona con la explicación que propones?';
const generator = async ({ text, types = ['inferential'], count = 1 }) => {
  const quote = text.split('\n').find(line => line.trim())?.trim() || text;
  const start = [...text].join('').indexOf(quote);
  // Test fixtures use BMP characters; offsets are explicitly code points in the API.
  const evidence = [{ quote, start: [...text.slice(0, start)].length, end: [...text.slice(0, start)].length + [...quote].length,
    reason: 'Esta pista permite justificar una inferencia si se explica su relación con la conclusión.' }];
  return { questions: Array.from({ length: count }, (_, index) => {
    const type = types[index % types.length];
    const common = { id: `generated-${index + 1}`, type, prompt: 'Explica qué puedes inferir de esta pista y por qué.',
      rubric: 'Pide una inferencia, una cita pertinente y el vínculo lógico entre ambas.', evidence };
    if (type === 'matching') return { ...common, prompt: 'Relaciona cada indicio con su observación.',
      left: [{ id: 'l1', text: 'Indicio uno' }, { id: 'l2', text: 'Indicio dos' }],
      right: [{ id: 'r1', text: 'Observación uno' }, { id: 'r2', text: 'Observación dos' }],
      correctAnswer: { l1: 'r1', l2: 'r2' } };
    if (type === 'completion') return { ...common, prompt: 'Completa: una inferencia necesita ____ que la respalde.',
      acceptedAnswers: ['evidencia', 'evidencia textual'] };
    return common;
  }) };
};
const app = await createPlatformApp({ db, tutor, generator, allowSetup: true,
  logger: { error() {}, warn() {}, info() {} } });
const server = app.listen(3102, '127.0.0.1');
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.once(signal, () => {
    server.close(async () => { await db.close(); process.exit(0); });
    server.closeIdleConnections();
  });
}
