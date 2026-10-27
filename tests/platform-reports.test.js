import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { once } from 'node:events';
import ExcelJS from 'exceljs';
import { openDatabase } from '../src/platform/db.js';
import { reportRecords, resultsWorkbook } from '../src/platform/reports.js';
import { createSheetsRouter, initSheetsSchema } from '../src/platform/sheets.js';
import { redactPersonalData } from '../src/platform/privacy.js';
import { createOpenAITutor } from '../src/ai/openai.js';

let db;
const teacher = { id: 'report-teacher', role: 'teacher' };
before(async () => {
  db = await openDatabase(); await initSheetsSchema(db);
  for (const id of [teacher.id, 'other-teacher']) await db.query("INSERT INTO users(id,username,name,role,password_hash) VALUES($1,$1,$1,'teacher','fixture-not-a-login')", [id]);
  await db.query("INSERT INTO users(id,username,name,role,owner_id,password_hash) VALUES('report-student','report-student','Lector azul','student',$1,'fixture-not-a-login')", [teacher.id]);
  await db.query("INSERT INTO groups(id,owner_id,name) VALUES('report-group',$1,'Cuarto A')", [teacher.id]);
  await db.query("INSERT INTO enrollments(group_id,student_id) VALUES('report-group','report-student')");
  await db.query("INSERT INTO activities(id,owner_id,title,reading_text,reading_hash,status,content) VALUES('report-activity',$1,'Pistas','Lectura','hash','published',$2::jsonb)", [teacher.id, JSON.stringify({ questions: [{ id: 'q1', type: 'mcq', prompt: '¿Qué pista importa?', correctAnswer: 'KEY_NOT_FOR_EXPORT' }] })]);
  await db.query("INSERT INTO assignments(id,owner_id,group_id,activity_id) VALUES('report-assignment',$1,'report-group','report-activity')", [teacher.id]);
  await db.query("INSERT INTO attempts(id,assignment_id,student_id,status,draft,answers,objective_score,max_objective,submitted_at) VALUES('report-attempt','report-assignment','report-student','submitted',$1::jsonb,$2::jsonb,1,1,NOW())", [JSON.stringify({ posture: '=HYPERLINK("https://example.com","no ejecutar")', reasoning: 'La pista permite revisar la interpretación con una razón propia.' }), JSON.stringify({ q1: 'a' })]);
  await db.query("INSERT INTO sync_outbox(id,owner_id,attempt_id,result_version) VALUES('report-event',$1,'report-attempt',1)", [teacher.id]);
});
after(async () => db?.close());

test('Excel autorizado conserva vínculo del razonamiento, tres hojas y texto sin fórmulas', async () => {
  const records = await reportRecords(db, teacher, { attemptId: 'report-attempt' });
  const book = new ExcelJS.Workbook(); await book.xlsx.load(await resultsWorkbook(db, records));
  assert.deepEqual(book.worksheets.map(s => s.name), ['Resumen', 'Respuestas', 'LectorLab']);
  const values = []; book.getWorksheet('Respuestas').eachRow(row => values.push(JSON.stringify(row.values)));
  assert.match(values.join('\n'), /La pista permite revisar/);
  assert.doesNotMatch(values.join('\n'), /KEY_NOT_FOR_EXPORT/);
  const posture = book.getWorksheet('Respuestas').getCell('D4');
  assert.equal(posture.type, ExcelJS.ValueType.String);
  assert.equal(posture.formula, undefined);
  await assert.rejects(reportRecords(db, { id: 'other-teacher', role: 'teacher' }, { attemptId: 'report-attempt' }), { status: 404 });
  await assert.rejects(reportRecords(db, { id: 'report-student', role: 'student' }, { groupId: 'report-group' }), { status: 403 });
  assert.equal((await reportRecords(db, { id: 'report-student', role: 'student' }, { attemptId: 'report-attempt' })).length, 1);
});

async function serve(t, client) {
  const app = express(); app.use(express.json());
  // Session/CSRF have a dedicated HTTP suite. This fixture isolates the Sheets service.
  app.use((req, _res, next) => { req.user = req.get('x-fixture-user') === 'student'
    ? { id: 'report-student', role: 'student' } : req.get('x-fixture-user') === 'other'
      ? { id: 'other-teacher', role: 'teacher' } : teacher; next(); });
  app.use(createSheetsRouter({ db, client }));
  app.use((error, _req, res, _next) => res.status(error.status || 500).json({ error: error.message }));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  return (path, { method = 'GET', body, user } = {}) => fetch(`http://127.0.0.1:${server.address().port}${path}`, {
    method, headers: { 'Content-Type': 'application/json', ...(user ? { 'x-fixture-user': user } : {}) }, body: body === undefined ? undefined : JSON.stringify(body),
  });
}

test('Google ausente no pierde la entrega ni la cola y no permite conexión estudiantil', async t => {
  const request = await serve(t, null);
  const state = await (await request('/integrations/sheets')).json();
  assert.equal(state.configured, false); assert.equal(state.pendingCount, 1);
  assert.equal((await request('/integrations/sheets/sync', { method: 'POST', body: {} })).status, 503);
  assert.equal((await request('/integrations/sheets', { user: 'student' })).status, 403);
  assert.equal((await db.query("SELECT status FROM attempts WHERE id='report-attempt'")).rows[0].status, 'submitted');
});

test('Sheets reconcilia reintento por ID tras timeout, sin compartir destino entre docentes', async t => {
  const rows = new Map(); let timeout = true;
  const client = { verify: async () => {}, upsert: async (_id, values) => {
    rows.set(values[0], values); if (timeout) { timeout = false; throw new Error('timeout tras escribir'); }
  } };
  const request = await serve(t, client);
  const destination = 'spreadsheet_fixture_0123456789';
  assert.equal((await request('/integrations/sheets', { method: 'PUT', body: { spreadsheetId: destination } })).status, 200);
  assert.equal((await request('/integrations/sheets', { method: 'PUT', user: 'other', body: { spreadsheetId: destination } })).status, 409);
  const first = await (await request('/integrations/sheets/sync', { method: 'POST', body: {} })).json();
  assert.equal(first.synced, 0); assert.equal(first.pending, 1);
  const second = await (await request('/integrations/sheets/sync', { method: 'POST', body: {} })).json();
  assert.equal(second.synced, 1); assert.equal(second.pending, 0); assert.equal(rows.size, 1);
  assert.equal(rows.get('report-attempt').length, 10);
  const third = await (await request('/integrations/sheets/sync', { method: 'POST', body: {} })).json();
  assert.equal(third.synced, 0);
});

test('minimización de IA oculta correo, DNI y teléfono sin borrar evidencia guardada', async () => {
  const original = 'Escríbeme a lector@example.com; DNI: 12345678; teléfono +51 987 654 321.';
  const redacted = redactPersonalData(original);
  assert.doesNotMatch(redacted, /lector@example|12345678|987/);
  let input;
  const tutor = createOpenAITutor({ model: 'test-only', client: { responses: { create: async data => { input = data; return { output_text: '¿Qué pista usaste?' }; } } } });
  await tutor({ instructions: original, history: [{ role: 'user', content: original }], message: original });
  assert.doesNotMatch(JSON.stringify(input), /lector@example|12345678|987/);
  assert.match(original, /lector@example/); // In-memory original not mutated; DB access is separately protected.
});
