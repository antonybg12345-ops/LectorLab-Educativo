import express from 'express';
import { randomBytes, randomUUID, createHash, timingSafeEqual, scrypt as callbackScrypt } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(callbackScrypt);
const cookieName = 'lectorlab_session';
const sessionLifetimeMs = 8 * 60 * 60 * 1000;
const hashOptions = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };

function fail(status, message) { return Object.assign(new Error(message), { status }); }
function object(value) { return value && typeof value === 'object' && !Array.isArray(value); }
function usernameValue(value) {
  if (typeof value !== 'string') throw fail(400, 'Escribe un usuario de acceso.');
  const username = value.normalize('NFC').trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{2,39}$/.test(username)) {
    throw fail(400, 'El usuario debe tener entre 3 y 40 letras sin tildes, números, puntos, guiones o guiones bajos.');
  }
  return username;
}
function userInput(input) {
  if (!object(input)) throw fail(400, 'Envía los datos de acceso como un objeto.');
  const username = usernameValue(input.username);
  if (typeof input.name !== 'string' || !input.name.trim() || [...input.name.trim()].length > 80) {
    throw fail(400, 'El nombre de uso debe tener entre 1 y 80 caracteres. Puedes usar un seudónimo.');
  }
  if (typeof input.password !== 'string' || input.password.length < 10 || input.password.length > 128) {
    throw fail(400, 'La contraseña debe tener entre 10 y 128 caracteres.');
  }
  return { username, name: input.name.normalize('NFC').trim(), password: input.password };
}
function publicUser(row) {
  return { id: row.id, username: row.username, name: row.name, role: row.role, ownerId: row.owner_id ?? null };
}
function digest(value) { return createHash('sha256').update(value).digest('hex'); }
function token() { return randomBytes(32).toString('base64url'); }
function constantEquals(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string' || left.length !== right.length) return false;
  const a = Buffer.from(left), b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
function readCookie(req) {
  const header = req.headers.cookie;
  if (typeof header !== 'string' || header.length > 8192) return null;
  const matches = header.split(';').map(part => part.trim()).filter(part => part.startsWith(`${cookieName}=`));
  if (matches.length !== 1) return null;
  const value = matches[0].slice(cookieName.length + 1);
  return /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null;
}

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 32, hashOptions);
  return `scrypt-v1$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

export async function verifyPassword(password, encoded) {
  if (typeof password !== 'string' || password.length > 128 || typeof encoded !== 'string') return false;
  const [version, saltText, hashText, extra] = encoded.split('$');
  if (version !== 'scrypt-v1' || extra !== undefined || !/^[A-Za-z0-9_-]{22}$/.test(saltText ?? '')
    || !/^[A-Za-z0-9_-]{43}$/.test(hashText ?? '')) return false;
  const actual = await scrypt(password, Buffer.from(saltText, 'base64url'), 32, hashOptions);
  const expected = Buffer.from(hashText, 'base64url');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** Individual server-side sessions and CSRF. The router never accepts a client
 * role. createUser is an internal service for authorized teacher enrollment. */
export function createAuth({ db, secureCookies = false, allowSetup = true } = {}) {
  if (!db) throw new TypeError('Se requiere una base de datos.');
  const router = express.Router();
  const failures = new Map();
  // Unknown accounts perform the same password verification work. The random
  // dummy credential is never stored or usable as a login credential.
  const dummyPassword = hashPassword(token());

  function setCookie(res, value, maxAge) {
    res.append('Set-Cookie', `${cookieName}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secureCookies ? '; Secure' : ''}`);
  }
  function writeGuard(req, _res, next, allowMultipart = false) {
    try {
      if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        if (!req.is('application/json') && !(allowMultipart && req.is('multipart/form-data'))) {
          throw fail(415, allowMultipart ? 'Esta operación requiere JSON o un documento adjunto.' : 'Esta operación requiere JSON.');
        }
        if (req.get('Sec-Fetch-Site') === 'cross-site') throw fail(403, 'Origen de solicitud no permitido.');
        const origin = req.get('Origin');
        if (origin && origin !== `${req.protocol}://${req.get('host')}`) throw fail(403, 'Origen de solicitud no permitido.');
      }
      next();
    } catch (error) { next(error); }
  }
  router.use(writeGuard);

  async function loadSession(req) {
    if (req.authLoaded) return;
    req.authLoaded = true;
    const sessionToken = readCookie(req);
    req.user = null;
    req.session = null;
    if (!sessionToken) return;
    const { rows } = await db.query(`SELECT s.id_hash, s.csrf, s.expires_at, u.id, u.username, u.name, u.role, u.owner_id
      FROM sessions s JOIN users u ON u.id=s.user_id
      WHERE s.id_hash=$1 AND s.expires_at>NOW() AND NOT u.disabled`, [digest(sessionToken)]);
    if (!rows.length) return;
    req.user = publicUser(rows[0]);
    req.session = { idHash: rows[0].id_hash, csrf: rows[0].csrf, expiresAt: rows[0].expires_at };
    req.csrfToken = rows[0].csrf;
  }
  async function requireUser(req, _res, next) {
    try {
      await loadSession(req);
      if (!req.user) throw fail(401, 'Inicia sesión para continuar.');
      next();
    } catch (error) { next(error); }
  }
  function requireRole(role) {
    return async (req, _res, next) => {
      try {
        await loadSession(req);
        if (!req.user) throw fail(401, 'Inicia sesión para continuar.');
        if (req.user.role !== role) throw fail(403, 'Tu cuenta no tiene permiso para esta operación.');
        next();
      } catch (error) { next(error); }
    };
  }
  async function requireCsrf(req, _res, next) {
    try {
      await loadSession(req);
      if (!req.user) throw fail(401, 'Inicia sesión para continuar.');
      const supplied = req.get('X-CSRF-Token');
      if (!constantEquals(supplied, req.session.csrf)) throw fail(403, 'La sesión necesita actualizarse antes de guardar.');
      writeGuard(req, _res, next, true);
    } catch (error) { next(error); }
  }

  async function insertUser(client, data, role, ownerId, encoded) {
    if (!['teacher', 'student'].includes(role)) throw fail(400, 'Rol no válido.');
    if (role === 'student') {
      if (typeof ownerId !== 'string' || !ownerId) throw fail(400, 'El estudiante necesita un docente responsable.');
      const teacher = await client.query("SELECT id FROM users WHERE id=$1 AND role='teacher' AND NOT disabled", [ownerId]);
      if (!teacher.rows.length) throw fail(400, 'El estudiante necesita un docente responsable.');
    } else if (ownerId) throw fail(400, 'Un docente no debe registrarse como estudiante.');
    const user = { id: randomUUID(), ...data, role, owner_id: role === 'student' ? ownerId : null };
    try {
      await client.query(`INSERT INTO users(id,username,name,role,owner_id,password_hash) VALUES($1,$2,$3,$4,$5,$6)`,
        [user.id, user.username, user.name, user.role, user.owner_id, encoded]);
    } catch (error) {
      if (error.code === '23505') throw fail(409, 'Ese usuario de acceso ya está registrado.');
      throw error;
    }
    return publicUser(user);
  }
  async function createUser(input, transaction = null) {
    const data = userInput(input);
    const encoded = await hashPassword(data.password);
    if (transaction) return insertUser(transaction, data, input.role, input.ownerId, encoded);
    return db.transaction(tx => insertUser(tx, data, input.role, input.ownerId, encoded));
  }

  async function establishSession(client, req, user) {
    const existing = readCookie(req);
    if (existing) await client.query('DELETE FROM sessions WHERE id_hash=$1', [digest(existing)]);
    await client.query('DELETE FROM sessions WHERE expires_at<=NOW()');
    const sessionToken = token(), csrfToken = token();
    await client.query('INSERT INTO sessions(id_hash,user_id,csrf,expires_at) VALUES($1,$2,$3,$4)',
      [digest(sessionToken), user.id, csrfToken, new Date(Date.now() + sessionLifetimeMs)]);
    return { sessionToken, csrfToken };
  }
  function signedIn(res, user, session, status = 200) {
    res.setHeader('Cache-Control', 'no-store');
    setCookie(res, session.sessionToken, sessionLifetimeMs / 1000);
    return res.status(status).json({ user, csrfToken: session.csrfToken, setupRequired: false });
  }

  router.get('/session', async (req, res, next) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      await loadSession(req);
      if (req.user) return res.json({ user: req.user, csrfToken: req.session.csrf, setupRequired: false });
      const count = await db.query('SELECT COUNT(*) AS count FROM users');
      res.json({ user: null, setupRequired: allowSetup && Number(count.rows[0].count) === 0 });
    } catch (error) { next(error); }
  });

  router.post('/setup', async (req, res, next) => {
    try {
      if (!allowSetup) throw fail(403, 'La creación inicial está deshabilitada en esta instalación.');
      const data = userInput(req.body);
      const encoded = await hashPassword(data.password);
      const result = await db.transaction(async tx => {
        await tx.exec('LOCK TABLE users IN EXCLUSIVE MODE');
        const count = await tx.query('SELECT COUNT(*) AS count FROM users');
        if (Number(count.rows[0].count) !== 0) throw fail(409, 'La instalación ya tiene una cuenta docente. Inicia sesión.');
        const user = await insertUser(tx, data, 'teacher', null, encoded);
        return { user, session: await establishSession(tx, req, user) };
      });
      signedIn(res, result.user, result.session, 201);
    } catch (error) { next(error); }
  });

  function loginBucket(req, username) {
    const now = Date.now();
    for (const [key, value] of failures) if (now >= value.expiresAt) failures.delete(key);
    const key = `${req.ip ?? 'unknown'}:${username}`;
    const bucket = failures.get(key) ?? { failures: 0, expiresAt: now + 15 * 60 * 1000 };
    if (bucket.failures >= 8) throw fail(429, 'Demasiados intentos de acceso. Espera unos minutos antes de reintentar.');
    return { key, bucket };
  }

  router.post('/login', async (req, res, next) => {
    try {
      if (!object(req.body)) throw fail(400, 'Envía usuario y contraseña.');
      const username = usernameValue(req.body.username);
      const attempt = loginBucket(req, username);
      const { rows } = await db.query('SELECT * FROM users WHERE username=$1', [username]);
      const matches = await verifyPassword(req.body.password, rows[0]?.password_hash ?? await dummyPassword);
      const valid = rows.length && !rows[0].disabled && matches;
      if (!valid) {
        attempt.bucket.failures++;
        if (failures.size >= 1000) failures.delete(failures.keys().next().value);
        failures.set(attempt.key, attempt.bucket);
        throw fail(401, 'Usuario o contraseña no válidos.');
      }
      failures.delete(attempt.key);
      const user = publicUser(rows[0]);
      const session = await db.transaction(tx => establishSession(tx, req, user));
      signedIn(res, user, session);
    } catch (error) { next(error); }
  });

  router.post('/logout', requireCsrf, async (req, res, next) => {
    try {
      await db.query('DELETE FROM sessions WHERE id_hash=$1', [req.session.idHash]);
      setCookie(res, '', 0);
      res.setHeader('Cache-Control', 'no-store');
      res.json({ ok: true });
    } catch (error) { next(error); }
  });

  return { router, requireUser, requireRole, requireCsrf, createUser, loadSession, writeGuard };
}
