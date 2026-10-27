// Preserved Stage A demo, deliberately separate from the authenticated platform.
// It has no real AI adapter and always binds loopback. Never use it for assessment.
import { createApp } from '../src/app.js';
const server = createApp().listen(3001, '127.0.0.1', () => console.log('RED histórico Etapa A en loopback:3001; sin identidad ni persistencia.'));
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close(() => process.exit(0)));
