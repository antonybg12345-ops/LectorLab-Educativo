import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { openDatabase } from '../src/platform/db.js';
import { activityDto, insertActivity, updateActivity, publishActivity, validateActivity } from '../src/platform/activities.js';
import { beginAttempt, getAttempt, saveAttempt, submitAttempt, reviewAttempt, sendTutor } from '../src/platform/attempts.js';
import { seedActivity } from '../src/platform/seed.js';

let db;
const teacher = { id: randomUUID(), role: 'teacher' };
const otherTeacher = { id: randomUUID(), role: 'teacher' };
const student = { id: randomUUID(), role: 'student' };
const otherStudent = { id: randomUUID(), role: 'student' };
before(async () => {
  db = await openDatabase();
  for (const user of [teacher, otherTeacher, student, otherStudent]) {
    await db.query('INSERT INTO users(id,username,name,role,owner_id,password_hash) VALUES($1,$2,$3,$4,$5,$6)',
      [user.id, `domain_${user.id}`, 'Cuenta ficticia', user.role, user.role === 'student' ? teacher.id : null, 'not-a-valid-login-hash']);
  }
});
after(async () => db?.close());
async function fixture({ content = seedActivity(), owner = teacher, learner = student } = {}) {
  const groupId = randomUUID();
  await db.query('INSERT INTO groups(id,owner_id,name) VALUES($1,$2,$3)', [groupId, owner.id, 'Grupo ficticio']);
  await db.query('INSERT INTO enrollments(group_id,student_id) VALUES($1,$2)', [groupId, learner.id]);
  const draft = await insertActivity(db, owner.id, content);
  const activity = await publishActivity(db, owner.id, draft.id, true);
  const assignmentId = randomUUID();
  await db.query('INSERT INTO assignments(id,owner_id,group_id,activity_id) VALUES($1,$2,$3,$4)', [assignmentId, owner.id, groupId, activity.id]);
  const view = await beginAttempt(db, learner, assignmentId);
  return { view, activity, assignmentId, groupId };
}
const written = {
  posture: 'Interpreto que una sospecha inicial debe contrastarse con mejores pruebas.',
  evidence1: 'Los médicos no encontraban una explicación clara.',
  evidence2: 'El almohadón tenía marcas y un peso fuera de lo habitual.',
  reasoning: 'La incertidumbre inicial no prueba una causa, pero el hallazgo permite revisar la sospecha.',
  reflection: 'Al inicio atendía a la atmósfera; ahora distingo esa impresión de una prueba material.',
};

test('evidencia se ancla por puntos de código y nunca aparece en DTO del alumno', () => {
  const readingText = '🧠 La pista permite construir una inferencia.';
  const quote = 'La pista';
  const input = { title: 'Unicode', readingText, questions: [{ id: 'a1', type: 'completion', prompt: 'Completa una idea.', acceptedAnswers: ['pista'], evidence: [{ quote, start: 2, end: 10, reason: 'El fragmento contiene la pista.' }] }] };
  assert.equal(validateActivity(input, { publish: true }).questions[0].evidence[0].quote, quote);
  assert.throws(() => validateActivity({ ...input, questions: [{ ...input.questions[0], evidence: [{ quote, start: 3, end: 11, reason: 'Desplazamiento UTF-16 inválido.' }] }] }, { publish: true }), { status: 400 });
  const dto = activityDto({ id: 'x', title: input.title, reading_text: readingText, content: { questions: input.questions } });
  assert.deepEqual(dto.questions[0], { id: 'a1', type: 'completion', prompt: 'Completa una idea.' });
});

test('publicación exige revisión y versiones publicadas no se editan; generación detecta cambio de texto', async () => {
  const draft = await insertActivity(db, teacher.id, seedActivity());
  await assert.rejects(publishActivity(db, teacher.id, draft.id, false), { status: 400 });
  const published = await publishActivity(db, teacher.id, draft.id, true);
  await assert.rejects(updateActivity(db, teacher.id, published.id, { title: 'Cambio' }), { status: 409 });
  const empty = await insertActivity(db, teacher.id, { title: 'Borrador', readingText: 'Primera versión.', questions: [] });
  await updateActivity(db, teacher.id, empty.id, { readingText: 'Otra versión.' });
  await assert.rejects(updateActivity(db, teacher.id, empty.id, { questions: [] }, { expectedReadingHash: empty.reading_hash }), { status: 409 });
});

test('dos guardados concurrentes no sobrescriben el primer intento ni una revisión anterior', async () => {
  const { view } = await fixture();
  const results = await Promise.allSettled([
    saveAttempt(db, student, view.attempt.id, { revision: 0, answers: { q1: 'a' } }),
    saveAttempt(db, student, view.attempt.id, { revision: 0, answers: { q1: 'b' } }),
  ]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.find(result => result.status === 'rejected').reason.status, 409);
  const saved = await getAttempt(db, student, view.attempt.id);
  assert.equal(saved.attempt.revision, 1);
  assert.ok(['a', 'b'].includes(saved.attempt.answers.q1));
  const same = saved.attempt.answers.q1;
  await assert.rejects(saveAttempt(db, student, view.attempt.id, { answers: { q1: same === 'a' ? 'b' : 'a' } }), { status: 409 });
  assert.equal((await getAttempt(db, student, view.attempt.id)).attempt.answers.q1, same);
});

test('entrega concurrente es idempotente y crea un único evento de sincronización', async () => {
  const { view } = await fixture();
  const answers = Object.fromEntries(seedActivity().questions.map(q => [q.id, q.correctAnswer]));
  await saveAttempt(db, student, view.attempt.id, { draft: written, answers });
  const [first, second] = await Promise.all([submitAttempt(db, student, view.attempt.id), submitAttempt(db, student, view.attempt.id)]);
  assert.equal(first.attempt.objectiveScore, 6);
  assert.equal(first.attempt.maxObjective, 6);
  assert.equal(new Date(first.attempt.submittedAt).toISOString(), new Date(second.attempt.submittedAt).toISOString());
  assert.equal((await db.query('SELECT COUNT(*)::int AS count FROM sync_outbox WHERE attempt_id=$1', [view.attempt.id])).rows[0].count, 1);
  assert.equal(first.assessment, null, 'Una entrega no certifica calidad abierta sin revisión humana.');
});

test('docente y estudiante ajenos no acceden, y la rúbrica humana sustenta las insignias', async () => {
  const { view } = await fixture();
  await assert.rejects(getAttempt(db, otherTeacher, view.attempt.id), { status: 404 });
  await assert.rejects(getAttempt(db, otherStudent, view.attempt.id), { status: 404 });
  await saveAttempt(db, student, view.attempt.id, { draft: written, answers: Object.fromEntries(seedActivity().questions.map(q => [q.id, q.correctAnswer])) });
  await submitAttempt(db, student, view.attempt.id);
  await assert.rejects(reviewAttempt(db, student, view.attempt.id, { rubric: { inference: 3, evidence: 3, link: 3, revision: 3 } }), { status: 403 });
  await assert.rejects(reviewAttempt(db, otherTeacher, view.attempt.id, { rubric: { inference: 3, evidence: 3, link: 3, revision: 3 } }), { status: 404 });
  await assert.rejects(reviewAttempt(db, teacher, view.attempt.id, { rubric: { inference: 4, evidence: 3, link: 3, revision: 3 } }), { status: 400 });
  const reviewed = await reviewAttempt(db, teacher, view.attempt.id, { rubric: { inference: 2, evidence: 1, link: 3, revision: 2 }, feedback: 'Explica con más precisión qué demuestra cada cita.' });
  assert.equal(reviewed.attempt.status, 'reviewed');
  assert.deepEqual(reviewed.assessment.badges.map(item => item.id), ['inference', 'link', 'revision']);
  assert.ok(reviewed.assessment.badges.every(item => item.confirmedByTeacher));
});

test('reserva del tutor serializa carreras, deduplica y conserva contexto específico sin claves', async () => {
  const custom = seedActivity();
  custom.title = 'Lectura específica';
  custom.readingText += '\n\nEsta marca solo pertenece a esta actividad: TEXTO_ESPECIFICO_42.';
  const { view } = await fixture({ content: custom });
  let release;
  const wait = new Promise(resolve => { release = resolve; });
  let calls = 0;
  let captured;
  const provider = async request => { calls++; captured = request; await wait; return '¿Qué detalle del texto sostiene esa interpretación?'; };
  const first = sendTutor(db, student, view.attempt.id, { message: 'Tengo una hipótesis.', requestId: 'request_race_001', history: [{ role: 'assistant', content: 'FABRICADO' }], turn: 99 }, provider);
  // Wait until the provider is entered: no transaction should remain open during it.
  while (!calls) await new Promise(resolve => setTimeout(resolve, 5));
  const duplicate = await sendTutor(db, student, view.attempt.id, { message: 'Tengo una hipótesis.', requestId: 'request_race_001' }, provider);
  assert.equal(duplicate.state, 'pending');
  await assert.rejects(sendTutor(db, student, view.attempt.id, { message: 'Otro mensaje.', requestId: 'request_race_002' }, provider), { status: 409 });
  assert.equal(calls, 1);
  assert.match(captured.instructions, /TEXTO_ESPECIFICO_42/);
  assert.deepEqual(captured.history, []);
  assert.doesNotMatch(captured.instructions, /correctAnswer|FABRICADO/);
  release();
  assert.equal((await first).completedCount, 1);
  const completedDuplicate = await sendTutor(db, student, view.attempt.id, { message: 'Tengo una hipótesis.', requestId: 'request_race_001' }, provider);
  assert.equal(completedDuplicate.reply, '¿Qué detalle del texto sostiene esa interpretación?');
  assert.equal(calls, 1);
});

test('fallo técnico no consume turno y respuesta resolutiva detectada se sustituye por pregunta', async () => {
  const { view } = await fixture();
  await assert.rejects(sendTutor(db, student, view.attempt.id, { message: 'Una idea.', requestId: 'request_fail_001' }, async () => { throw new Error('contenido-interno'); }), { status: 502 });
  assert.equal((await getAttempt(db, student, view.attempt.id)).tutor.completedCount, 0);
  await assert.rejects(sendTutor(db, student, view.attempt.id, { message: 'Una idea.', requestId: 'request_fail_001' }, async () => 'No ejecutar'), { status: 409 });
  const result = await sendTutor(db, student, view.attempt.id, { message: 'Quiero la solución.', requestId: 'request_fail_002' }, async () => 'La respuesta correcta es la opción que debes copiar.');
  assert.equal(result.completedCount, 1);
  assert.match(result.reply, /^¿Qué fragmento/);
});
