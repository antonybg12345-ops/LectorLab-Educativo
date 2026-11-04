import express from 'express';
import { fileURLToPath } from 'node:url';
import { createAuth } from './auth.js';
import { createPlatformRouter } from './router.js';
import { createDocumentsRouter } from './documents.js';
import { createReportsRouter } from './reports.js';
import { createSheetsRouter, initSheetsSchema } from './sheets.js';

const platformDirectory = fileURLToPath(new URL('../../public/platform/', import.meta.url));

export async function createPlatformApp({ db, tutor = null, generator = null, allowSetup = true,
  secureCookies = false, sheets = null, trustProxy = false, logger = console } = {}) {
  if (!db) throw new TypeError('Se requiere PostgreSQL para la plataforma.');
  await initSheetsSchema(db);
  const app = express();
  app.disable('x-powered-by');
  if (trustProxy) app.set('trust proxy', 1);
  app.use((_req, res, next) => {
    res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin',
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
      'Cache-Control': 'no-store' });
    next();
  });
  app.use(express.json({ limit: '512kb' }));
  const auth = createAuth({ db, secureCookies, allowSetup });
  const health = (_req, res) => res.json({ ok: true, mode: 'platform-preview', database: db.kind,
    aiConfigured: Boolean(tutor), generationConfigured: Boolean(generator), externalConnectionsVerified: false });
  app.get('/api/health', health);
  app.get('/api/v1/health', health);
  app.use('/api/v1/auth', auth.router);
  // A single authenticated boundary also protects future routes by default.
  app.use('/api/v1', auth.requireUser, (req, res, next) => ['GET', 'HEAD', 'OPTIONS'].includes(req.method)
    ? next() : auth.requireCsrf(req, res, next));
  app.use('/api/v1', createReportsRouter({ db }));
  app.use('/api/v1', createSheetsRouter({ db, client: sheets }));
  app.use('/api/v1', createPlatformRouter({ db, auth, tutor, generator }));
  app.use('/api/v1', createDocumentsRouter({ db, auth, generator }));
  // Legacy APIs are deliberately not mounted: they would bypass session/attempt authority.
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Ruta no disponible. Usa el acceso de docente o estudiante.' }));
  app.use('/platform', express.static(platformDirectory, { index: false, dotfiles: 'deny' }));
  app.use(express.static(platformDirectory, { index: false, dotfiles: 'deny' }));
  // Public entry routes also serve the shell on direct navigation/reload. The
  // session API and authenticated API boundary still determine access and role.
  for (const route of ['/', '/docente', '/estudiante', '/ingresar/docente', '/ingresar/estudiante', '/como-funciona', '/acerca-de']) {
    app.get(route, (_req, res) => res.sendFile('index.html', { root: platformDirectory }));
  }
  app.use((_req, res) => res.status(404).send('Página no encontrada.'));
  app.use((error, _req, res, _next) => {
    if (error.type === 'entity.too.large' || error.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'La solicitud supera el tamaño permitido.' });
    if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'El cuerpo JSON no es válido.' });
    const status = Number.isInteger(error.status) && error.status >= 400 && error.status < 500 ? error.status
      : [502, 503, 504].includes(error.status) ? error.status : 500;
    if (status === 500) logger.error?.('Fallo interno de plataforma', { code: 'PLATFORM_ERROR' });
    res.status(status).json({ error: status === 500 ? 'No se pudo completar la operación. Tus datos guardados permanecen disponibles.' : error.message });
  });
  return app;
}
