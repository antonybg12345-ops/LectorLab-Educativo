import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { openDatabase } from '../src/platform/db.js';
import { createAuth, hashPassword, verifyPassword } from '../src/platform/auth.js';

const password = 'Lecturas-prueba-2026';

async function fixture(t, options = {}) {
  const db = await openDatabase();
  const auth = createAuth({ db, ...options });
  const app = express();
  app.use(express.json());
  app.use('/api/v1/auth', auth.router);
  app.get('/teacher', auth.requireRole('teacher'), (req, res) => res.json({ id: req.user.id }));
  app.post('/write', auth.requireUser, auth.requireCsrf, (req, res) => res.json({ actor: req.user.id }));
  app.use((error, _req, res, _next) => res.status(error.status ?? 500).json({ error: error.status ? error.message : 'Error interno' }));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    await db.close();
  });
  async function request(route, { method = 'GET', body, cookie, csrf, origin, contentType = 'application/json' } = {}) {
    const headers = {};
    if (cookie) headers.Cookie = cookie;
    if (csrf) headers['X-CSRF-Token'] = csrf;
    if (origin) headers.Origin = origin;
    if (body !== undefined) headers['Content-Type'] = contentType;
    return fetch(base + route, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  }
  return { db, auth, request, base };
}

function credentials(username) { return { username, name: `Seudónimo ${username}`, password }; }
function sessionCookie(response) { return response.headers.get('set-cookie').split(';')[0]; }

test('PostgreSQL local, configuración inicial única y sesiones reales con CSRF', async t => {
  const { db, auth, request, base } = await fixture(t);
  let teacher, cookie, csrf;

  await t.test('instalación vacía no autentica; dos setups concurrentes solo crean un docente', async () => {
    assert.deepEqual(await (await request('/api/v1/auth/session')).json(), { user: null, setupRequired: true });
    assert.equal((await request('/teacher')).status, 401);
    const setups = await Promise.all(['docente-a', 'docente-b'].map(username => request('/api/v1/auth/setup', {
      method: 'POST', body: { ...credentials(username), role: 'student' },
    })));
    assert.deepEqual(setups.map(response => response.status).sort(), [201, 409]);
    const accepted = setups.find(response => response.status === 201);
    const data = await accepted.json();
    teacher = data.user; cookie = sessionCookie(accepted); csrf = data.csrfToken;
    assert.equal(teacher.role, 'teacher');
    assert.equal(Object.hasOwn(teacher, 'password_hash'), false);
    assert.equal(Object.hasOwn(teacher, 'password'), false);
    assert.match(accepted.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
    const stored = await db.query('SELECT COUNT(*) AS n FROM users');
    assert.equal(Number(stored.rows[0].n), 1);
  });

  await t.test('identidad viene de sesión y no del cuerpo; tokens no se almacenan en claro', async () => {
    const session = await (await request('/api/v1/auth/session', { cookie })).json();
    assert.equal(session.user.id, teacher.id);
    assert.equal(session.csrfToken, csrf);
    assert.equal(session.setupRequired, false);
    const stored = (await db.query('SELECT * FROM sessions')).rows[0];
    assert.equal(stored.id_hash.length, 64);
    assert.notEqual(stored.id_hash, cookie.split('=')[1]);
    const write = await request('/write', { method: 'POST', cookie, csrf, body: { role: 'student', userId: 'otra-persona' } });
    assert.equal(write.status, 200);
    assert.equal((await write.json()).actor, teacher.id);
  });

  await t.test('CSRF y origen bloquean escrituras aunque exista cookie', async () => {
    for (const options of [
      { cookie }, { cookie, csrf: 'inventado' }, { cookie, csrf, origin: 'https://otro-sitio.example' },
    ]) {
      assert.equal((await request('/write', { method: 'POST', body: {}, ...options })).status, 403);
    }
    assert.equal((await request('/write', { method: 'POST', cookie, csrf, origin: base, body: {} })).status, 200);
    assert.equal((await request('/api/v1/auth/login', { method: 'POST', body: credentials(teacher.username), contentType: 'text/plain' })).status, 415);
    const upload = new FormData(); upload.set('text', 'Documento sintético');
    const accepted = await fetch(base + '/write', { method: 'POST', headers: { Cookie: cookie, 'X-CSRF-Token': csrf }, body: upload });
    assert.equal(accepted.status, 200);
    const missingToken = new FormData(); missingToken.set('text', 'Documento sintético');
    assert.equal((await fetch(base + '/write', { method: 'POST', headers: { Cookie: cookie }, body: missingToken })).status, 403);
  });

  await t.test('rol estudiante no abre rutas docentes y alumno requiere docente responsable', async () => {
    await assert.rejects(auth.createUser({ ...credentials('sin-docente'), role: 'student' }), error => error.status === 400);
    const student = await auth.createUser({ ...credentials('estudiante-a'), role: 'student', ownerId: teacher.id });
    assert.equal(student.ownerId, teacher.id);
    const response = await request('/api/v1/auth/login', { method: 'POST', body: credentials(student.username) });
    assert.equal(response.status, 200);
    const studentCookie = sessionCookie(response);
    assert.equal((await request('/teacher', { cookie: studentCookie })).status, 403);
    const studentSession = await (await request('/api/v1/auth/session', { cookie: studentCookie })).json();
    assert.equal(studentSession.user.id, student.id);
    assert.equal(studentSession.user.role, 'student');
    assert.notEqual(studentSession.csrfToken, csrf);
  });

  await t.test('alta y matrícula comparten transacción y se revierten juntas', async () => {
    await assert.rejects(db.transaction(async tx => {
      await tx.query('INSERT INTO groups(id,owner_id,name,grade) VALUES($1,$2,$3,$4)',
        ['grupo-rollback', teacher.id, 'Grupo de prueba', '4']);
      const student = await auth.createUser({ ...credentials('matricula-rollback'), role: 'student', ownerId: teacher.id }, tx);
      await tx.query('INSERT INTO enrollments(group_id,student_id) VALUES($1,$2)', ['grupo-rollback', student.id]);
      throw new Error('cancelar-alta-matricula');
    }), /cancelar-alta-matricula/);
    assert.equal((await db.query('SELECT id FROM users WHERE username=$1', ['matricula-rollback'])).rows.length, 0);
    assert.equal((await db.query('SELECT id FROM groups WHERE id=$1', ['grupo-rollback'])).rows.length, 0);
  });

  await t.test('cierre revoca sesión de verdad; login rota cookie y sesión', async () => {
    const logout = await request('/api/v1/auth/logout', { method: 'POST', cookie, csrf, body: {} });
    assert.equal(logout.status, 200);
    assert.match(logout.headers.get('set-cookie'), /Max-Age=0/);
    assert.equal((await request('/teacher', { cookie })).status, 401);
    const login = await request('/api/v1/auth/login', { method: 'POST', body: credentials(teacher.username) });
    assert.equal(login.status, 200);
    assert.notEqual(sessionCookie(login), cookie);
    const rotated = await request('/api/v1/auth/login', { method: 'POST', cookie: sessionCookie(login), body: credentials(teacher.username) });
    assert.equal(rotated.status, 200);
    assert.equal((await request('/teacher', { cookie: sessionCookie(login) })).status, 401);
    cookie = sessionCookie(rotated); csrf = (await rotated.json()).csrfToken;
  });

  await t.test('sesión caducada o usuario deshabilitado no da acceso', async () => {
    await db.query('UPDATE sessions SET expires_at=$1 WHERE user_id=$2', [new Date(2000, 0, 1), teacher.id]);
    assert.equal((await request('/teacher', { cookie })).status, 401);
    const login = await request('/api/v1/auth/login', { method: 'POST', body: credentials(teacher.username) });
    const newCookie = sessionCookie(login);
    await db.query('UPDATE users SET disabled=TRUE WHERE id=$1', [teacher.id]);
    assert.equal((await request('/teacher', { cookie: newCookie })).status, 401);
    assert.equal((await request('/api/v1/auth/login', { method: 'POST', body: credentials(teacher.username) })).status, 401);
    await db.query('UPDATE users SET disabled=FALSE WHERE id=$1', [teacher.id]);
  });

  await t.test('intentos de contraseña incorrecta se limitan sin revelar existencia', async () => {
    for (let index = 0; index < 8; index++) {
      const response = await request('/api/v1/auth/login', { method: 'POST', body: { username: 'inexistente', password: 'dato-falso' } });
      assert.equal(response.status, 401);
    }
    assert.equal((await request('/api/v1/auth/login', { method: 'POST', body: { username: 'inexistente', password } })).status, 429);
  });
});

test('hash scrypt individual, contraseña inválida y setup deshabilitado', async t => {
  const first = await hashPassword(password), second = await hashPassword(password);
  assert.notEqual(first, second);
  assert.equal(await verifyPassword(password, first), true);
  assert.equal(await verifyPassword('otra-clave', first), false);
  assert.equal(await verifyPassword(password, 'hash-no-válido'), false);
  const { auth, request } = await fixture(t, { allowSetup: false, secureCookies: true });
  const setup = await request('/api/v1/auth/setup', { method: 'POST', body: credentials('docente-externo') });
  assert.equal(setup.status, 403);
  await assert.rejects(auth.createUser({ ...credentials('clave-corta'), password: '123', role: 'teacher' }), error => error.status === 400);
  await auth.createUser({ ...credentials('docente-seguro'), role: 'teacher' });
  const login = await request('/api/v1/auth/login', { method: 'POST', body: credentials('docente-seguro') });
  assert.equal(login.status, 200);
  assert.match(login.headers.get('set-cookie'), /; Secure$/);
});

test('persistencia PostgreSQL embebida conserva datos y rechaza abrir dos procesos sobre el mismo directorio', async t => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'lectorlab-db-'));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const dataDir = path.join(temporary, 'postgres');
  const first = await openDatabase({ dataDir });
  await first.query('INSERT INTO users(id,username,name,role,password_hash) VALUES($1,$2,$3,$4,$5)',
    ['persistente', 'prueba-persistente', 'Prueba sintética', 'teacher', 'no-es-una-credencial-real']);
  await assert.rejects(openDatabase({ dataDir }), /Otra instancia/);
  await first.close();
  const reopened = await openDatabase({ dataDir });
  assert.equal((await reopened.query('SELECT username FROM users WHERE id=$1', ['persistente'])).rows[0].username, 'prueba-persistente');
  await assert.rejects(reopened.transaction(async tx => {
    await tx.query('UPDATE users SET name=$1 WHERE id=$2', ['No conservar', 'persistente']);
    throw new Error('rollback-de-prueba');
  }), /rollback-de-prueba/);
  assert.equal((await reopened.query('SELECT name FROM users WHERE id=$1', ['persistente'])).rows[0].name, 'Prueba sintética');
  await reopened.close();
});
