import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import ExcelJS from 'exceljs';
import { openDatabase } from '../src/platform/db.js';
import { createPlatformApp } from '../src/platform/app.js';

async function harness(t) {
  const db = await openDatabase({ dataDir: 'memory://' });
  const providerRequests = [];
  const tutor = async request => {
    providerRequests.push(request);
    return '¿Qué fragmento sostiene tu idea y cómo se relaciona con tu explicación?';
  };
  const generator = async ({ text }) => {
    const quote = text.split('\n').find(line => line.trim()).trim();
    return { questions: [{ id: 'inference-generated', type: 'inferential',
      prompt: '¿Qué puedes inferir y qué pista sostiene esa interpretación?', rubric: 'Valorar inferencia, evidencia y vínculo lógico.',
      evidence: [{ start: 0, end: [...quote].length, quote, reason: 'La pista debe relacionarse con la explicación propuesta.' }] }] };
  };
  const app = await createPlatformApp({ db, tutor, generator, allowSetup: true, logger: { error() {}, warn() {} } });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    await db.close();
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  function client() {
    const cookies = new Map();
    let csrf = '';
    async function request(method, route, body, { multipart } = {}) {
      const headers = { Origin: base };
      if (cookies.size) headers.Cookie = [...cookies].map(([k, v]) => `${k}=${v}`).join('; ');
      if (csrf) headers['X-CSRF-Token'] = csrf;
      if (!multipart && body !== undefined) headers['Content-Type'] = 'application/json';
      const response = await fetch(base + '/api/v1' + route, { method, headers,
        body: multipart || (body === undefined ? undefined : JSON.stringify(body)) });
      for (const value of response.headers.getSetCookie()) {
        const [pair] = value.split(';');
        const separator = pair.indexOf('=');
        const key = pair.slice(0, separator), content = pair.slice(separator + 1);
        if (content) cookies.set(key, content); else cookies.delete(key);
      }
      return response;
    }
    async function json(method, route, body, expected) {
      const response = await request(method, route, body);
      const output = await response.json();
      if (expected !== undefined) assert.equal(response.status, expected, JSON.stringify(output));
      if (output.csrfToken) csrf = output.csrfToken;
      return { status: response.status, ...output };
    }
    return { request, json };
  }
  return { db, base, client, providerRequests };
}

test('Plataforma HTTP: autoría revisada → asignación → respuestas persistidas → tutor → entrega → devolución y Excel', async t => {
  const { client, providerRequests } = await harness(t);
  const teacher = client(), student = client(), anonymous = client();
  const first = await teacher.json('GET', '/auth/session', undefined, 200);
  assert.equal(first.setupRequired, true);
  const setup = await teacher.json('POST', '/auth/setup', { username: 'docente-flow', name: 'Docente de prueba', password: 'Docente_Flow_2026!' }, 201);
  assert.equal(setup.user.role, 'teacher');
  const { group } = await teacher.json('POST', '/groups', { name: 'Cuarto de prueba', grade: '4.º secundaria' }, 201);
  await teacher.json('POST', `/groups/${group.id}/students`, { username: 'estudiante-flow', name: 'Lector de prueba', password: 'Estudiante_Flow_2026!' }, 201);
  const { activity } = await teacher.json('POST', '/activities/seed', {}, 201);
  assert.equal(activity.status, 'draft');
  assert.equal(activity.questions.length, 6);
  await teacher.json('POST', `/activities/${activity.id}/publish`, {}, 400);
  const published = await teacher.json('POST', `/activities/${activity.id}/publish`, { reviewed: true }, 200);
  assert.equal(published.activity.status, 'published');
  const { assignment } = await teacher.json('POST', '/assignments', { groupId: group.id, activityId: activity.id }, 201);
  assert.equal((await anonymous.request('GET', '/assignments')).status, 401);

  await student.json('POST', '/auth/login', { username: 'estudiante-flow', password: 'Estudiante_Flow_2026!' }, 200);
  assert.equal((await student.request('GET', '/groups')).status, 403);
  const assigned = await student.json('GET', '/assignments', undefined, 200);
  assert.ok(assigned.assignments.some(item => item.id === assignment.id));
  const started = await student.json('POST', `/assignments/${assignment.id}/attempt`, {}, 200);
  const attemptId = started.attempt.id;
  const replayStart = await student.json('POST', `/assignments/${assignment.id}/attempt`, {}, 200);
  assert.equal(replayStart.attempt.id, attemptId);
  assert.doesNotMatch(JSON.stringify(started.activity.questions), /correctAnswer|acceptedAnswers|"rubric"|"evidence"/);
  const draft = {
    initial: 'Una explicación necesita pistas que puedan contrastarse.',
    hypothesis: 'Antes del final habría considerado una causa desconocida.',
    posture: 'La interpretación debe revisarse cuando aparece evidencia material que contradice una sospecha inicial.',
    evidence1: activity.readingText.split('\n').filter(Boolean)[0],
    evidence2: activity.readingText.split('\n').filter(Boolean)[1],
    reasoning: 'La incertidumbre médica no demuestra la responsabilidad de Jordán; la pista material permite contrastar esa sospecha.',
    reflection: 'Al inicio sospeché de Jordán, pero después diferencié la impresión inicial de las pruebas que explican lo ocurrido.',
    finalThought: 'Ahora entiendo que revisar una idea ante evidencia nueva fortalece el razonamiento.',
  };
  await student.json('PATCH', `/attempts/${attemptId}`, { draft, answers: { q1: 'b' }, score: 999, correct: true }, 200);
  const changed = await student.request('PATCH', `/attempts/${attemptId}`, { answers: { q1: 'a' } });
  assert.ok([200, 409].includes(changed.status));
  const recovered = await student.json('GET', `/attempts/${attemptId}`, undefined, 200);
  assert.equal(recovered.attempt.answers.q1, 'b');
  assert.equal(recovered.attempt.draft.posture, draft.posture);
  await student.json('PATCH', `/attempts/${attemptId}`, { answers: { q2: 'c', q3: 'a', q4: 'c', q5: 'a', q6: 'b' } }, 200);

  const requestId = randomUUID();
  const firstTutor = await student.json('POST', `/attempts/${attemptId}/tutor`, { message: '¿Qué pista debería analizar con más cuidado?', requestId,
    turn: 1, history: [{ role: 'assistant', content: 'Historial fabricado que no debe usarse.' }] }, 200);
  assert.ok(firstTutor.reply || firstTutor.tutor || firstTutor.turn);
  await student.json('POST', `/attempts/${attemptId}/tutor`, { message: '¿Qué pista debería analizar con más cuidado?', requestId }, 200);
  assert.equal(providerRequests.length, 1);
  assert.doesNotMatch(JSON.stringify(providerRequests[0]), /Historial fabricado/);
  assert.match(providerRequests[0].instructions, /Alicia/);
  for (let index = 1; index < 5; index++) {
    await student.json('POST', `/attempts/${attemptId}/tutor`, { message: `Mi interpretación número ${index} requiere una pista del relato.`, requestId: randomUUID(), turn: 1 }, 200);
  }
  const sixth = await student.request('POST', `/attempts/${attemptId}/tutor`, { message: 'No debe existir un sexto turno.', requestId: randomUUID(), turn: 1 });
  assert.ok(sixth.status >= 400);
  assert.equal(providerRequests.length, 5);
  const submitted = await student.json('POST', `/attempts/${attemptId}/submit`, { score: 999, maxScore: 999, correct: true }, 200);
  assert.equal(submitted.attempt.status, 'submitted');
  assert.equal(submitted.attempt.objectiveScore, 6);
  assert.equal(submitted.attempt.maxObjective, 6);
  const ownExport = await student.request('GET', `/attempts/${attemptId}/export.xlsx`);
  assert.equal(ownExport.status, 200);
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(Buffer.from(await ownExport.arrayBuffer()));
  assert.deepEqual(book.worksheets.map(sheet => sheet.name), ['Resumen', 'Respuestas', 'LectorLab']);
  const values = [];
  book.worksheets.forEach(sheet => sheet.eachRow(row => values.push(JSON.stringify(row.values))));
  assert.match(values.join('\n'), /La interpretación debe revisarse/);
  assert.doesNotMatch(values.join('\n'), /999|password_hash|Estudiante_Flow/);
  assert.equal((await student.request('GET', `/groups/${group.id}/export.xlsx`)).status, 403);
  assert.equal((await student.request('GET', `/attempts/${randomUUID()}`)).status, 404);

  const reviewed = await teacher.json('POST', `/attempts/${attemptId}/review`, {
    rubric: { inference: 3, evidence: 2, link: 3, revision: 2 },
    feedback: 'Explicaste el vínculo entre la pista y la conclusión. Revisa si tu segunda evidencia añade información distinta.',
  }, 200);
  assert.equal(reviewed.attempt.status, 'reviewed');
  const returned = await student.json('GET', `/attempts/${attemptId}`, undefined, 200);
  assert.match(returned.assessment.feedback, /Explicaste el vínculo/);
  const groupExport = await teacher.request('GET', `/groups/${group.id}/export.xlsx`);
  assert.equal(groupExport.status, 200);
  const consolidated = new ExcelJS.Workbook();
  await consolidated.xlsx.load(Buffer.from(await groupExport.arrayBuffer()));
  assert.ok(consolidated.worksheets.length >= 1);
  const frozen = await teacher.request('PATCH', `/activities/${activity.id}`, { title: 'No modificar versión publicada' });
  assert.equal(frozen.status, 409);
});

test('Plataforma HTTP: TXT extraído y generación con proveedor inyectado permanecen borradores hasta revisión docente', async t => {
  const { client } = await harness(t);
  const teacher = client(), anonymous = client();
  await teacher.json('POST', '/auth/setup', { username: 'docente-doc', name: 'Docente de documentos', password: 'Docente_Doc_2026!' }, 201);
  const text = 'La ventana estaba abierta cuando Mariana llegó al aula.\nEn el suelo había gotas de lluvia junto al cuaderno.';
  const form = new FormData();
  form.set('file', new Blob([text], { type: 'text/plain' }), 'lectura-prueba.txt');
  const upload = await teacher.request('POST', '/documents', undefined, { multipart: form });
  assert.equal(upload.status, 201, await upload.clone().text());
  const uploaded = await upload.json();
  const document = uploaded.document;
  assert.ok(document.id);
  assert.match(document.text || document.textContent || document.text_content, /Mariana llegó/);
  const created = await teacher.json('POST', `/documents/${document.id}/activity`, { title: 'Indicios de lluvia', reviewedText: text }, 201);
  assert.equal(created.activity.status, 'draft');
  const generated = await teacher.json('POST', `/activities/${created.activity.id}/generate`, { count: 1, types: ['inferential'], textReviewed: true }, 200);
  assert.equal(generated.activity.status, 'draft');
  assert.equal(generated.activity.questions.length, 1);
  assert.equal(generated.activity.questions[0].evidence[0].quote, text.split('\n')[0]);
  assert.equal((await anonymous.request('GET', `/documents/${document.id}`)).status, 401);
});
