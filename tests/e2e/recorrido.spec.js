import { test as base, expect } from '@playwright/test';
import ExcelJS from 'exceljs';

// External illustrations are not needed to validate the local workflow.
// Application exceptions fail every test, including errors after a click.
const test = base.extend({
  page: async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://**/*', route => route.abort());
    await use(page);
    expect(errors, 'El navegador no debe emitir errores JavaScript').toEqual([]);
  },
});

const answers = { q1: 'b', q2: 'c', q3: 'a', q4: 'c', q5: 'a', q6: 'b' };
const interpretation = 'El cuento muestra que una primera sospecha necesita revisarse cuando aparecen nuevas evidencias materiales.';
const evidence1 = 'Alicia volvía a encontrarse agotada a la mañana siguiente, aunque parecía recuperarse.';
const evidence2 = 'Las pequeñas marcas y el peso anormal del almohadón llevaron a examinarlo después.';
const reflection = 'Al inicio sospeché de la frialdad de Jordán, pero la evidencia del almohadón me llevó a revisar esa explicación.';

async function goToTutor(page, { keyboard = false } = {}) {
  await page.goto('/');
  await expect(page.locator('.step')).toHaveCount(7);
  await expect(page.locator('.choice')).toHaveCount(18);
  await page.locator('#initial').fill('Una explicación necesita pistas que puedan contrastarse con otras posibilidades.');
  if (keyboard) {
    await page.locator('#startBtn').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.step[data-step="1"] h2')).toBeFocused();
  } else {
    await page.locator('#startBtn').click();
  }
  await expect(page.locator('.reading p')).toHaveCount(7);
  await page.locator('.step[data-step="1"] .next').click();
  await expect(page.locator('#next2')).toBeDisabled();
  for (let stage = 2; stage <= 4; stage++) {
    for (let n = (stage - 2) * 2 + 1; n <= (stage - 2) * 2 + 2; n++) {
      const question = `q${n}`;
      await page.locator(`.choice[data-q="${question}"][data-v="${answers[question]}"]`).click();
      const options = page.locator(`.choice[data-q="${question}"]`);
      for (let option = 0; option < 3; option++) await expect(options.nth(option)).toBeDisabled();
      await expect(page.locator(`#fb${n}`)).toContainText('primera respuesta');
    }
    if (stage === 3) await page.locator('#hypothesis').fill('Antes del final sospecharía de una causa todavía desconocida porque faltaban pruebas.');
    await page.locator(`#next${stage}`).click();
  }
  await expect(page.locator('.step[data-step="5"]')).toBeVisible();
}

async function send(page, message) {
  await page.locator('#chatInput').fill(message);
  await page.locator('#chatForm button').click();
}

test('recorrido completo, foco al avanzar con teclado y Excel con tres hojas', async ({ page }) => {
  const exports = [];
  page.on('request', request => {
    if (request.url().endsWith('/api/export-xlsx')) exports.push(request.postDataJSON());
  });
  await goToTutor(page, { keyboard: true });
  for (let n = 1; n <= 5; n++) {
    await send(page, `Mi pista ${n} necesita una explicación basada en el relato.`);
    await expect(page.locator('#chatCount')).toContainText(`${n} de 5`);
  }
  await expect(page.locator('#chatInput')).toBeDisabled();
  await expect(page.locator('#chatForm button')).toBeDisabled();
  await page.locator('.step[data-step="5"] .next').click();
  await page.locator('#posture').fill(interpretation);
  await page.locator('#ev1').fill(evidence1);
  await page.locator('#ev2').fill(evidence2);
  await page.locator('#reflection').fill(reflection);
  await page.locator('#finish').click();
  await expect(page.locator('#result')).toBeVisible();
  await expect(page.locator('#result h2')).toBeFocused();
  await expect(page.locator('#score')).toHaveText('9/9');
  await page.locator('#finalThought').fill('Ahora considero que una explicación debe enlazar las pistas con una razón y admitir revisión.');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('#download').click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(await download.path());
  expect(workbook.worksheets.map(sheet => sheet.name)).toEqual(['Resumen', 'Respuestas', 'LectorLab']);
  const values = [];
  for (const sheet of workbook.worksheets) sheet.eachRow(row => values.push(JSON.stringify(row.values)));
  expect(values.join('\n')).toContain('9/9');
  expect(values.join('\n')).toContain(interpretation);
  expect(values.join('\n')).toContain(evidence1);
  expect(values.join('\n')).toContain('Mi pista 5 necesita una explicación basada en el relato.');
  // A later download includes the new closing reflection without moving the
  // completion timestamp or recalculating the completed submission.
  const revisedThought = 'Mi reflexión ampliada: contrastar una alternativa también ayuda a evaluar la explicación.';
  await page.locator('#finalThought').fill(revisedThought);
  const [secondDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('#download').click(),
  ]);
  expect(exports).toHaveLength(2);
  expect(exports[1].completedAt).toBe(exports[0].completedAt);
  expect(exports[1].finalThought).toBe(revisedThought);
  const laterWorkbook = new ExcelJS.Workbook();
  await laterWorkbook.xlsx.readFile(await secondDownload.path());
  const laterValues = [];
  laterWorkbook.getWorksheet('Respuestas').eachRow(row => laterValues.push(JSON.stringify(row.values)));
  expect(laterValues.join('\n')).toContain(revisedThought);
  await expect(page.locator('.sources')).toContainText('Currículo Nacional');
});

test('un fallo IA conserva el texto y permite reintentar sin gastar un turno', async ({ page }, testInfo) => {
  await goToTutor(page);
  const message = `__retry__-${testInfo.project.name}`;
  await send(page, message);
  await expect(page.locator('#chatInput')).toBeEnabled();
  await expect(page.locator('#chatInput')).toHaveValue(message);
  await expect(page.locator('#chatCount')).toContainText('0 de 5');
  await expect(page.locator('#chatLog')).toContainText('no fue contabilizada');
  await page.locator('#chatForm button').click();
  await expect(page.locator('#chatCount')).toContainText('1 de 5');
});

test('solicitud pendiente bloquea doble envío y navegación hasta completarse', async ({ page }, testInfo) => {
  await goToTutor(page);
  let tutorRequests = 0;
  page.on('request', request => {
    if (request.url().endsWith('/api/lectorlab')) tutorRequests++;
  });
  await send(page, `__pending__-${testInfo.project.name}`);
  await expect(page.locator('#chatInput')).toBeDisabled();
  await expect(page.locator('#chatForm button')).toBeDisabled();
  await expect(page.locator('.step[data-step="5"] .next')).toBeDisabled();
  await expect(page.locator('.step[data-step="5"] .prev')).toBeDisabled();
  // A programmatic duplicate submit must also respect pending state.
  await page.locator('#chatForm').dispatchEvent('submit');
  await expect(page.locator('#chatCount')).toContainText('1 de 5');
  await expect(page.locator('.step[data-step="5"] .next')).toBeEnabled();
  expect(tutorRequests).toBe(1);
});

test('recargar con trabajo pendiente avisa y cancelar preserva el escrito', async ({ page }) => {
  await page.goto('/');
  // Browsers require a real user gesture before showing beforeunload dialogs.
  await page.locator('#initial').click();
  await page.locator('#initial').fill('Esta idea todavía no se ha guardado y quiero conservarla.');
  const dialogPromise = page.waitForEvent('dialog');
  // Do not wait for a navigation that is intentionally cancelled by the user.
  await page.evaluate(() => { setTimeout(() => window.location.reload(), 0); });
  const dialog = await dialogPromise;
  expect(dialog.type()).toBe('beforeunload');
  await dialog.dismiss();
  await expect(page.locator('#initial')).toHaveValue('Esta idea todavía no se ha guardado y quiero conservarla.');
});

test('Reiniciar permite cancelar o aceptar sin un segundo aviso beforeunload', async ({ page }) => {
  await goToTutor(page);
  // The tutor remains optional in the original pedagogical sequence.
  await page.locator('.step[data-step="5"] .next').click();
  await page.locator('#finish').click();
  await expect(page.locator('#result')).toBeVisible();
  const dialogs = [];
  let acceptRestart = false;
  page.on('dialog', async dialog => {
    dialogs.push(dialog.type());
    if (dialog.type() === 'confirm' && acceptRestart) await dialog.accept();
    else await dialog.dismiss();
  });
  await page.locator('#restart').click();
  await expect(page.locator('#result')).toBeVisible();
  expect(dialogs).toEqual(['confirm']);
  acceptRestart = true;
  await page.locator('#restart').click();
  await expect(page.locator('.step[data-step="0"]')).toBeVisible();
  await expect(page.locator('#initial')).toHaveValue('');
  expect(dialogs).toEqual(['confirm', 'confirm']);
});
