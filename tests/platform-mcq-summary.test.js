import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import express from 'express';
import { openDatabase } from '../src/platform/db.js';
import { insertActivity, publishActivity } from '../src/platform/activities.js';
import { beginAttempt, saveAttempt, submitAttempt, reviewAttempt, getAttempt, summarizeAlternatives } from '../src/platform/attempts.js';
import { createPlatformRouter } from '../src/platform/router.js';
import { seedActivity } from '../src/platform/seed.js';

const mcqs = Array.from({ length: 6 }, (_, index) => ({ id: `q${index}`, type: 'mcq',
  options: [{ id: 'a' }, { id: 'b' }], correctAnswer: 'b' }));

test('el porcentaje de alternativas excluye relación, completado y respuestas abiertas', () => {
  const questions = [...mcqs, { id: 'match', type: 'matching', correctAnswer: { left: 'right' } },
    { id: 'fill', type: 'completion', acceptedAnswers: ['pista'] }, { id: 'open', type: 'inferential' }];
  const answers = Object.fromEntries(mcqs.map(question => [question.id, 'b']));
  answers.q5 = 'a';
  answers.match = { left: 'right' }; answers.fill = 'pista'; answers.open = 'Una interpretación.';
  assert.deepEqual(summarizeAlternatives(questions, answers), { correct: 5, total: 6, percentage: 83.3 });
});

test('sin alternativas no se inventa un porcentaje y una respuesta ausente nunca es un acierto', () => {
  assert.deepEqual(summarizeAlternatives([{ id: 'text', type: 'completion', acceptedAnswers: ['a'] }], {}),
    { correct: 0, total: 0, percentage: null });
  assert.deepEqual(summarizeAlternatives(mcqs, {}), { correct: 0, total: 6, percentage: 0 });
  assert.deepEqual(summarizeAlternatives([{ id: 'missing-key', type: 'mcq', options: [{ id: 'a' }] }], {}),
    { correct: 0, total: 1, percentage: 0 });
  assert.deepEqual(summarizeAlternatives([{ id: 'bad-key', type: 'mcq', options: [{ id: 'a' }], correctAnswer: 'b' }], { 'bad-key': 'b' }),
    { correct: 0, total: 1, percentage: 0 });
});

let db, server, base;
const teacher = { id: randomUUID(), role: 'teacher' };
const otherTeacher = { id: randomUUID(), role: 'teacher' };
const student = { id: randomUUID(), role: 'student' };
before(async () => {
  db = await openDatabase({ dataDir: 'memory://' });
  for (const user of [teacher, otherTeacher, student]) {
    await db.query('INSERT INTO users(id,username,name,role,owner_id,password_hash) VALUES($1,$2,$3,$4,$5,$6)',
      [user.id, `mcq_${user.id}`, 'Cuenta ficticia', user.role, user.role === 'student' ? teacher.id : null, 'not-a-valid-login-hash']);
  }
  // Auth/session enforcement is covered by platform-auth.test.js. This harness
  // supplies trusted identities to exercise the real SQL owner filter and DTO.
  const auth = {
    requireUser(req, res, next) { req.user = req.headers['x-test-owner'] === 'other' ? otherTeacher : teacher; next(); },
    requireCsrf(req, res, next) { next(); },
    requireRole(role) { return (req, res, next) => req.user.role === role ? next() : res.sendStatus(403); },
  };
  const app = express();
  app.use('/api', createPlatformRouter({ db, auth }));
  app.use((error, req, res, next) => res.status(error.status || 500).json({ error: error.message }));
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => {
  server?.closeAllConnections();
  if (server) await new Promise(resolve => server.close(resolve));
  await db?.close();
});

test('BD y resultados conservan 5/6 alternativas, 7/8 objetivas y permisos, sin aceptar puntajes del cliente', async () => {
  const input = seedActivity();
  const evidence = structuredClone(input.questions[0].evidence);
  input.questions.push({ id: 'matching-extra', type: 'matching', prompt: 'Relaciona las pistas con los hechos.',
    left: [{ id: 'l1', text: 'Pista 1' }, { id: 'l2', text: 'Pista 2' }],
    right: [{ id: 'r1', text: 'Hecho 1' }, { id: 'r2', text: 'Hecho 2' }],
    correctAnswer: { l1: 'r1', l2: 'r2' }, evidence });
  input.questions.push({ id: 'completion-extra', type: 'completion', prompt: 'Completa la idea sobre el razonamiento.',
    acceptedAnswers: ['evidencia'], evidence });
  input.questions.push({ id: 'open-extra', type: 'inferential', prompt: 'Sustenta una inferencia con evidencia.',
    rubric: 'Inferencia, evidencia, vínculo y revisión.', evidence });
  const draftActivity = await insertActivity(db, teacher.id, input);
  const activity = await publishActivity(db, teacher.id, draftActivity.id, true);
  const groupId = randomUUID(), assignmentId = randomUUID();
  await db.query('INSERT INTO groups(id,owner_id,name) VALUES($1,$2,$3)', [groupId, teacher.id, 'Grupo ficticio']);
  await db.query('INSERT INTO enrollments(group_id,student_id) VALUES($1,$2)', [groupId, student.id]);
  await db.query('INSERT INTO assignments(id,owner_id,group_id,activity_id) VALUES($1,$2,$3,$4)',
    [assignmentId, teacher.id, groupId, activity.id]);
  const started = await beginAttempt(db, student, assignmentId);
  assert.equal(started.attempt.alternatives, null);
  assert.doesNotMatch(JSON.stringify(started.activity), /correctAnswer|acceptedAnswers/);

  const answers = Object.fromEntries(input.questions.slice(0, 6).map(question => [question.id, question.correctAnswer]));
  const last = input.questions[5];
  answers[last.id] = last.options.find(option => option.id !== last.correctAnswer).id;
  answers['matching-extra'] = { l1: 'r1', l2: 'r2' };
  answers['completion-extra'] = 'evidencia';
  answers['open-extra'] = 'La pista material permite contrastar una sospecha inicial.';
  const draft = { posture: 'Una sospecha necesita evidencia verificable.', evidence1: 'Primera pista.',
    evidence2: 'Segunda pista.', reasoning: 'Las pistas permiten revisar una hipótesis.', reflection: 'Distingo sospecha y prueba.' };
  const saved = await saveAttempt(db, student, started.attempt.id,
    { draft, answers, objectiveScore: 999, alternatives: { correct: 999, total: 999, percentage: 100 } });
  assert.equal(saved.attempt.alternatives, null, 'Guardar no revela un resumen final de alternativas.');
  let response = await fetch(`${base}/results?assignmentId=${assignmentId}`);
  assert.equal(response.status, 200);
  let result = (await response.json()).results[0];
  assert.equal(result.alternatives, null);

  const submitted = await submitAttempt(db, student, started.attempt.id);
  assert.deepEqual(submitted.attempt.alternatives, { correct: 5, total: 6, percentage: 83.3 });
  assert.equal(submitted.attempt.objectiveScore, 7);
  assert.equal(submitted.attempt.maxObjective, 8);
  assert.doesNotMatch(JSON.stringify(submitted.activity), /correctAnswer|acceptedAnswers/);
  response = await fetch(`${base}/results?assignmentId=${assignmentId}`);
  result = (await response.json()).results[0];
  assert.deepEqual(result.alternatives, submitted.attempt.alternatives);
  assert.equal(result.objectiveScore, 7);
  assert.equal(result.maxObjective, 8);
  assert.equal('answers' in result, false);
  assert.equal('questions' in result, false);
  assert.doesNotMatch(JSON.stringify(result), /correctAnswer|acceptedAnswers/);
  const foreign = await fetch(`${base}/results?assignmentId=${assignmentId}`, { headers: { 'X-Test-Owner': 'other' } });
  assert.deepEqual((await foreign.json()).results, []);

  await reviewAttempt(db, teacher, started.attempt.id,
    { rubric: { inference: 2, evidence: 3, link: 2, revision: 1 }, feedback: 'Explica qué aporta cada pista.' });
  const reviewed = await getAttempt(db, student, started.attempt.id);
  assert.equal(reviewed.attempt.status, 'reviewed');
  assert.deepEqual(reviewed.attempt.alternatives, submitted.attempt.alternatives);
  assert.deepEqual(reviewed.assessment.rubric, { inference: 2, evidence: 3, link: 2, revision: 1 });
});
