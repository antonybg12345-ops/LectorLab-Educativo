import { test as base, expect } from '@playwright/test';
import ExcelJS from 'exceljs';

const test = base.extend({
  page: async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://**/*', route => route.abort());
    await use(page);
    expect(errors, 'La experiencia no debe emitir errores JavaScript').toEqual([]);
  },
});
const teacher = { username: 'docente-e2e', password: 'Docente_E2E_2026!', name: 'Docente de prueba', role: 'teacher' };
const choices = { q1: 'b', q2: 'c', q3: 'a', q4: 'c', q5: 'a', q6: 'b' };

async function authenticate(page, account, setup = false) {
  await page.goto(account.role === 'student' ? '/ingresar/estudiante' : '/ingresar/docente');
  await page.getByTestId('auth-username').fill(account.username);
  if (setup) await page.getByTestId('auth-name').fill(account.name);
  await page.getByTestId('auth-password').fill(account.password);
  await page.getByTestId('auth-submit').click();
  await expect(page.getByTestId('logout')).toBeVisible();
}
async function responseTo(page, method, suffix, action) {
  const [response] = await Promise.all([
    page.waitForResponse(response => response.request().method() === method && new URL(response.url()).pathname.endsWith(suffix)),
    action(),
  ]);
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json();
}
async function saved(page) {
  await expect(page.getByTestId('save-status')).toHaveText(/Guardado/);
}
async function fillValue(locator, value) {
  const tag = await locator.evaluate(element => element.tagName);
  if (tag === 'SELECT') await locator.selectOption(String(value));
  else await locator.fill(String(value));
}
async function workbookDownload(page, testId) {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId(testId).click(),
  ]);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(await download.path());
  return workbook;
}

test('docente y estudiante completan publicación revisada, trabajo guardado, tutor, entrega y devolución', async ({ page }, info) => {
  const session = await (await page.request.get('/api/v1/auth/session')).json();
  await authenticate(page, teacher, session.setupRequired);
  const suffix = info.project.name.replace(/[^a-z0-9]/g, '-');
  const student = { username: `lector-${suffix}`, password: 'Estudiante_E2E_2026!', name: `Lector ${suffix}`, role: 'student' };

  await page.getByTestId('nav-groups').click();
  await page.getByTestId('group-name').fill(`Cuarto ${suffix}`);
  await page.getByTestId('group-grade').fill('4.º secundaria');
  const { group } = await responseTo(page, 'POST', '/groups', () => page.getByTestId('create-group').click());
  await page.getByTestId(`open-group-${group.id}`).click();
  await page.getByTestId('student-username').fill(student.username);
  await page.getByTestId('student-name').fill(student.name);
  await page.getByTestId('student-password').fill(student.password);
  await responseTo(page, 'POST', `/groups/${group.id}/students`, () => page.getByTestId('create-student').click());

  await page.getByTestId('nav-activities').click();
  const seeded = await responseTo(page, 'POST', '/activities/seed', () => page.getByTestId('seed-activity').click());
  let activity = seeded.activity;
  if (await page.getByTestId(`open-activity-${activity.id}`).isVisible()) await page.getByTestId(`open-activity-${activity.id}`).click();
  if (activity.status === 'published') {
    const copied = await responseTo(page, 'POST', `/activities/${activity.id}/clone`, () => page.getByTestId('clone-activity').click());
    activity = copied.activity;
  }
  await expect(page.getByTestId('publish-activity')).toBeVisible();
  await page.getByTestId('publish-reviewed').check();
  await responseTo(page, 'POST', `/activities/${activity.id}/publish`, () => page.getByTestId('publish-activity').click());
  await page.getByTestId('nav-assignments').click();
  await page.getByTestId('assignment-group').selectOption(group.id);
  await page.getByTestId('assignment-activity').selectOption(activity.id);
  const { assignment } = await responseTo(page, 'POST', '/assignments', () => page.getByTestId('create-assignment').click());
  await page.getByTestId('logout').click();
  await expect(page.getByTestId('entry-teacher')).toBeVisible();

  await authenticate(page, student);
  expect((await page.request.get('/api/v1/groups')).status()).toBe(403);
  await page.getByTestId(`open-assignment-${assignment.id}`).click();
  await expect(page.getByTestId('step-0')).toBeVisible();
  const interpretation = 'El relato muestra que las primeras sospechas deben revisarse cuando aparece una pista material que explica lo ocurrido.';
  await page.getByTestId('initial').fill('Una explicación debe relacionar pistas concretas con una conclusión que pueda revisarse.');
  await saved(page);
  await page.getByTestId('next-step').click();
  await expect(page.getByTestId('step-1')).toBeVisible();
  await expect(page.locator('body')).toContainText('Alicia y Jordán');
  await page.getByTestId('next-step').click();
  for (let stage = 2; stage <= 4; stage++) {
    await expect(page.getByTestId(`step-${stage}`)).toBeVisible();
    for (let number = (stage - 2) * 2 + 1; number <= (stage - 2) * 2 + 2; number++) {
      const question = `q${number}`;
      await page.getByTestId(`question-${question}-answer-option-${choices[question]}`).click();
      await saved(page);
    }
    if (stage === 3) {
      await page.getByTestId('hypothesis').fill('Antes del desenlace sospecharía de una causa aún desconocida porque los médicos no tenían una explicación.');
      await saved(page);
    }
    await page.getByTestId('next-step').click();
  }
  await expect(page.getByTestId('step-5')).toBeVisible();
  for (let n = 1; n <= 5; n++) {
    await page.getByTestId('tutor-input').fill(`La pista ${n} necesita un vínculo lógico con la interpretación.`);
    if (n === 1) {
      let release, reached;
      const gate = new Promise(resolve => { release = resolve; });
      const requested = new Promise(resolve => { reached = resolve; });
      const pattern = '**/api/v1/attempts/*/tutor';
      await page.route(pattern, async route => {
        const response = await route.fetch(); reached();
        await gate; await route.fulfill({ response });
      });
      try {
        await responseTo(page, 'POST', '/tutor', async () => {
          await page.getByTestId('tutor-send').click(); await requested;
          const activeUrl = page.url();
          // A real same-document Back navigation must keep the pending attempt,
          // including its identifier and step, when the leave guard refuses it.
          await page.evaluate(url => { history.pushState(null, '', '/estudiante'); history.pushState(null, '', url); }, activeUrl);
          await page.goBack();
          await expect(page).toHaveURL(activeUrl);
          await expect(page.getByTestId('tutor-send')).toBeDisabled();
          release();
        });
      } finally { release(); await page.unroute(pattern); }
    } else await responseTo(page, 'POST', '/tutor', () => page.getByTestId('tutor-send').click());
  }
  await expect(page.getByTestId('tutor-send')).toBeDisabled();
  await page.getByTestId('next-step').click();
  await expect(page.getByTestId('step-6')).toBeVisible();
  await page.getByTestId('posture').fill(interpretation);
  await page.getByTestId('evidence1').fill('Los médicos la examinaban sin encontrar una explicación clara.');
  await page.getByTestId('evidence2').fill('También notó algo extraño: pesaba mucho más de lo normal.');
  await page.getByTestId('reasoning').fill('La falta de explicación médica no demuestra culpa de Jordán; el peso anormal permite investigar una causa material distinta.');
  await page.getByTestId('reflection').fill('Al inicio sospeché por el ambiente del relato; después distinguí esa impresión de la evidencia que sustenta una causa.');
  await page.getByTestId('finalThought').fill('Cambiar una hipótesis con razones es parte de una lectura crítica.');
  await saved(page);

  // Returning to the assignment must recover the existing server-side attempt.
  await page.reload();
  if (await page.getByTestId(`open-assignment-${assignment.id}`).isVisible()) await page.getByTestId(`open-assignment-${assignment.id}`).click();
  // Some layouts reopen at the first step; navigate without changing the saved selections.
  for (let tries = 0; tries < 6 && !(await page.getByTestId('posture').isVisible()); tries++) {
    await page.getByTestId('next-step').click();
  }
  await expect(page.getByTestId('posture')).toHaveValue(interpretation);
  await responseTo(page, 'POST', '/submit', () => page.getByTestId('submit-attempt').click());
  const workbook = await workbookDownload(page, 'download-attempt');
  expect(workbook.worksheets.map(sheet => sheet.name)).toEqual(['Resumen', 'Respuestas', 'LectorLab']);
  const values = [];
  workbook.worksheets.forEach(sheet => sheet.eachRow(row => values.push(JSON.stringify(row.values))));
  expect(values.join('\n')).toContain(interpretation);
  expect(values.join('\n')).not.toContain(student.password);
  await page.getByTestId('logout').click();
  await expect(page.getByTestId('entry-teacher')).toBeVisible();

  await authenticate(page, teacher);
  await page.getByTestId('nav-results').click();
  const results = await (await page.request.get('/api/v1/results')).json();
  const result = results.results.find(item => item.studentUsername === student.username || item.studentName === student.name || item.groupId === group.id);
  expect(result).toBeTruthy();
  const attemptId = result.attemptId || result.id;
  await page.getByTestId(`open-result-${attemptId}`).click();
  for (const criterion of ['inference', 'evidence', 'link', 'revision']) await fillValue(page.getByTestId(`rubric-${criterion}`), criterion === 'evidence' ? 2 : 3);
  await page.getByTestId('review-feedback').fill('Explicaste cómo la pista cambia tu hipótesis. Revisa si ambas evidencias aportan información distinta.');
  await responseTo(page, 'POST', '/review', () => page.getByTestId('save-review').click());
  await expect(page.locator('body')).toContainText(/revisad/i);
});

test('un TXT y las propuestas de tres tipos permanecen borradores hasta la revisión explícita', async ({ page }, info) => {
  const session = await (await page.request.get('/api/v1/auth/session')).json();
  await authenticate(page, teacher, session.setupRequired);
  await page.getByTestId('nav-activities').click();
  const text = 'La ventana estaba abierta cuando Mariana llegó al aula.\nEn el suelo había gotas de lluvia junto al cuaderno.';
  await page.getByTestId('document-file').setInputFiles({ name: `lectura-${info.project.name}.txt`, mimeType: 'text/plain', buffer: Buffer.from(text) });
  await responseTo(page, 'POST', '/documents', () => page.getByTestId('upload-document').click());
  await expect(page.getByTestId('document-text')).toHaveValue(text);
  await page.getByTestId('document-title').fill(`Indicios y explicaciones ${info.project.name}`);
  await page.getByTestId('document-reviewed').check();
  const created = await responseTo(page, 'POST', '/activity', () => page.getByTestId('document-create-activity').click());
  const id = created.activity.id;
  await page.getByTestId('generation-reviewed').check();
  const generated = await responseTo(page, 'POST', `/activities/${id}/generate`, () => page.getByTestId('generate-questions').click());
  expect(generated.activity.status).toBe('draft');
  expect(generated.activity.questions.map(question => question.type)).toEqual(['inferential', 'matching', 'completion']);
  await expect(page.getByTestId('question-review-list')).toContainText('Inferencial abierta');
  await expect(page.getByTestId('question-review-list')).toContainText('Relación de elementos');
  await expect(page.getByTestId('question-review-list')).toContainText('Completado');
  await expect(page.getByTestId('question-review-list')).toContainText(text.split('\n')[0]);
  await page.getByTestId('publish-activity').click();
  await expect(page.locator('body')).toContainText('marca la confirmación');
  const stillDraft = await (await page.request.get(`/api/v1/activities/${id}`)).json();
  expect(stillDraft.activity.status).toBe('draft');
  await page.getByTestId('publish-reviewed').check();
  const published = await responseTo(page, 'POST', `/activities/${id}/publish`, () => page.getByTestId('publish-activity').click());
  expect(published.activity.status).toBe('published');
});
