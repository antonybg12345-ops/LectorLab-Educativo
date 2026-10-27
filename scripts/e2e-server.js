// Test-only server: never constructs an OpenAI client or reads a real API key.
import { createApp } from '../src/app.js';

const callsByMessage = new Map();
const tutor = async ({ message }) => {
  const count = (callsByMessage.get(message) || 0) + 1;
  callsByMessage.set(message, count);
  if (message.startsWith('__retry__') && count === 1) {
    throw new Error('Fallo de prueba del proveedor');
  }
  if (message.startsWith('__pending__')) {
    await new Promise(resolve => setTimeout(resolve, 600));
  }
  return '¿Qué pista del relato sostiene tu interpretación y cómo se relaciona con ella?';
};

const app = createApp({
  config: { model: 'test-model', maxTurns: 5 },
  tutor,
  logger: { error() {}, warn() {}, info() {} },
});
const server = app.listen(3101, '127.0.0.1');
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.once(signal, () => server.close(() => process.exit(0)));
}
