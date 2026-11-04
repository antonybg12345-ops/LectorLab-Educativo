import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile, stat, writeFile, mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { extname, resolve, sep, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Intentionally serves files only: the preview must work without Express/API.
const require = createRequire(new URL('../../package.json', import.meta.url));
const { chromium, expect } = require('@playwright/test');
const repository = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const publicRoot = resolve(process.argv[2] || join(repository, 'dist/pages-preview'));
const artifactDir = resolve(process.argv[3] || join(repository, 'dist/pages-preview-test-artifacts'));
await mkdir(artifactDir, { recursive: true });
const prefix = '/LectorLab-Educativo/';
const entryPath = `${prefix}avance/`;
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = createServer(async (request, response) => {
  try {
    if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405); response.end(); return; }
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (!pathname.startsWith(prefix)) { response.writeHead(404); response.end(); return; }
    let filename = resolve(publicRoot, pathname.slice(prefix.length));
    if (filename !== publicRoot && !filename.startsWith(publicRoot + sep)) { response.writeHead(404); response.end(); return; }
    if ((await stat(filename)).isDirectory()) filename = resolve(filename, 'index.html');
    const body = await readFile(filename);
    response.writeHead(200, { 'Content-Type': mime[extname(filename).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch (error) { response.writeHead(['ENOENT', 'ENOTDIR'].includes(error.code) ? 404 : 500); response.end(); }
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const origin = `http://127.0.0.1:${server.address().port}`;
const entryUrl = origin + entryPath;
let browser;
const results = [];

async function fits(page, label) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${label}: sin desborde horizontal`);
  assert.equal(new URL(page.url()).pathname, entryPath, `${label}: permanece en el prefijo de Pages`);
  assert.doesNotMatch(await page.locator('body').innerText(), /(?:^|\n)(?:undefined|null|false)(?:\n|$)/, `${label}: no imprime valores de código en la interfaz`);
}
async function home(page) {
  await expect(page.getByTestId('entry-teacher')).toBeVisible();
  await expect(page.getByTestId('entry-student')).toBeVisible();
  await expect(page.locator('.entry-art img')).toBeVisible();
}
async function login(page, role) {
  await page.getByTestId(`entry-${role}`).click();
  await expect(page.getByTestId('auth-password')).toBeDisabled();
  await expect(page.getByTestId('auth-username')).toBeDisabled();
  await page.getByTestId('auth-submit').click();
  await expect(page.getByTestId('logout')).toBeVisible();
  await expect(page.locator('.workspace-shell')).toBeVisible();
}
async function logout(page) {
  await page.getByTestId('logout').click();
  await home(page);
}
async function fillValue(locator, value) {
  if (await locator.evaluate(element => element.tagName) === 'SELECT') await locator.selectOption(String(value));
  else await locator.fill(String(value));
}
async function teacherHome(page) {
  await page.getByTestId('nav-home').click();
  await expect(page.getByRole('heading', { name: 'Tu panel docente', exact: true })).toBeVisible();
}
async function openExampleReview(page) {
  await page.getByTestId('nav-results').click();
  await page.getByTestId('open-result-demo-example').click();
  await expect(page.getByTestId('demo-review-total')).toBeVisible();
}
async function openCriterion(page, id) {
  const details = page.locator('details.rubric-criterion').filter({ has: page.getByTestId(`demo-rubric-name-${id}`) });
  if (!(await details.evaluate(element => element.open))) await details.locator('summary').click();
}

try {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined, headless: true });
  for (const viewport of [{ width: 1366, height: 900 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [], prohibited = [], failures = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', dialog => dialog.accept());
    page.on('response', response => { if (response.status() >= 400 && !response.url().endsWith('/favicon.ico')) failures.push({ url: response.url(), status: response.status() }); });
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      const blocked = ['http:', 'https:'].includes(url.protocol) && (url.origin !== origin || /(?:^|\/)api(?:\/|$)/i.test(url.pathname) || !['GET', 'HEAD'].includes(request.method()) || (!url.pathname.startsWith(prefix) && url.pathname !== '/favicon.ico'));
      if (blocked) { prohibited.push({ method: request.method(), url: request.url() }); await route.abort('blockedbyclient'); }
      else await route.continue();
    });
    const response = await page.goto(entryUrl, { waitUntil: 'networkidle' });
    assert.equal(response.status(), 200);
    await home(page);
    await fits(page, 'Bienvenida conservada');
    await login(page, 'teacher');
    await expect(page.getByRole('heading', { name: 'Tu panel docente', exact: true })).toBeVisible();
    await expect(page.locator('.workspace-sidebar')).toBeVisible();
    await expect(page.getByTestId('dashboard-prepare')).toBeVisible();
    await expect(page.getByTestId('dashboard-result-demo-example')).toBeVisible();
    await expect(page.getByTestId('dashboard-activity-demo-draft')).toBeVisible();
    await expect(page.getByTestId('dashboard-group-demo-group')).toBeVisible();
    if (viewport.width === 390) {
      const actionRect = await page.getByTestId('dashboard-result-demo-example').boundingBox();
      assert.ok(actionRect.x >= 0 && actionRect.x + actionRect.width <= viewport.width, 'La acción Revisar queda dentro del ancho móvil sin desplazamiento horizontal');
    }
    const titleFamily = await page.locator('.workspace-main h1').evaluate(element => getComputedStyle(element).fontFamily);
    assert.ok(!/^Georgia\b/i.test(titleFamily), 'Panel usa la tipografía de interfaz nueva');
    await fits(page, 'Panel docente nuevo');
    await page.screenshot({ path: `${artifactDir}/LectorLab_2_0_Panel_Docente_Actualizado${viewport.width === 390 ? '_Movil' : ''}.png`, fullPage: true });

    // Cards and sidebar must perform the same real navigation, not be decoration.
    await page.getByTestId('dashboard-group-demo-group').click();
    await expect(page.getByTestId('student-password')).toBeDisabled();
    await teacherHome(page);
    await page.getByTestId('dashboard-prepare').click();
    await expect(page.getByTestId('open-activity-demo-draft')).toBeVisible();
    await expect(page.getByTestId('document-file')).toBeDisabled();
    await expect(page.getByTestId('upload-document')).toBeDisabled();
    await page.getByTestId('open-activity-demo-draft').click();
    await expect(page.getByTestId('editor-step-1')).toHaveAttribute('aria-current', 'step');
    await expect(page.getByTestId('publish-activity')).toBeHidden();
    const reading = await page.getByTestId('edit-activity-reading').inputValue();
    const renamed = `Lectura preparada en ${viewport.width}px`;
    await page.getByTestId('edit-activity-title').fill(renamed);
    await page.getByTestId('editor-step-2').click();
    await expect(page.getByTestId('question-review-list')).toBeVisible();
    await expect(page.getByTestId('generate-questions')).toBeDisabled();
    await expect(page.getByTestId('publish-activity')).toBeHidden();
    await page.getByTestId('editor-step-3').click();
    await expect(page.getByTestId('demo-rubric-total')).toContainText('12');
    await expect(page.locator('.workspace-main')).toContainText(/Sin IA conectada|sin IA conectada/);
    await openCriterion(page, 'inference');
    const criterionName = 'Inferencia con respaldo textual';
    await page.getByTestId('demo-rubric-name-inference').fill(criterionName);
    await fillValue(page.getByTestId('demo-rubric-max-inference'), 4);
    await expect(page.getByTestId('demo-rubric-total')).toContainText('13');
    await fillValue(page.getByTestId('demo-rubric-max-inference'), 3);
    await page.getByTestId('editor-step-1').click();
    await expect(page.getByTestId('edit-activity-title')).toHaveValue(renamed);
    await expect(page.getByTestId('edit-activity-reading')).toHaveValue(reading);
    await page.getByTestId('editor-step-3').click();
    await openCriterion(page, 'inference');
    await expect(page.getByTestId('demo-rubric-name-inference')).toHaveValue(criterionName);
    await expect(page.getByTestId('demo-rubric-total')).toContainText('12');
    await page.locator('details.rubric-criterion').filter({ has: page.getByTestId('demo-rubric-name-inference') }).locator('summary').click();
    await fits(page, 'Editor y rúbrica');
    await page.screenshot({ path: `${artifactDir}/LectorLab_2_0_Rubrica_Actividad_Actualizada${viewport.width === 390 ? '_Movil' : ''}.png`, fullPage: true });
    await page.getByTestId('editor-step-4').click();
    await expect(page.getByTestId('publish-activity')).toBeVisible();
    await page.getByTestId('publish-activity').click();
    await expect(page.locator('.workspace-main')).toContainText(/marca la confirmación|confirmación|confirmar|revis/i);
    await expect(page.getByTestId('publish-reviewed')).not.toBeChecked();
    await page.getByTestId('publish-reviewed').check();
    await page.getByTestId('publish-activity').click();
    await expect(page.locator('.workspace-main')).toContainText('Publicada');
    await expect(page.getByTestId('clone-activity')).toBeVisible();

    await openExampleReview(page);
    await expect(page.getByTestId('demo-review-total')).toContainText('8/12');
    await expect(page.getByTestId('demo-review-status')).toContainText(/pendiente|Pendiente|Provisional|provisional/);
    await expect(page.locator('.workspace-main')).toContainText(/ejemplo|Ejemplo/);
    await fits(page, 'Rúbrica y validación');
    await page.screenshot({ path: `${artifactDir}/LectorLab_2_0_Revision_Docente_Actualizada${viewport.width === 390 ? '_Movil' : ''}.png`, fullPage: true });
    await fillValue(page.getByTestId('demo-review-score-evidence'), 2);
    await expect(page.getByTestId('demo-review-total')).toContainText('7/12');
    const feedback = `Devolución privada ${viewport.width}: conecta tus dos citas con la interpretación.`;
    await page.getByTestId('demo-review-feedback').fill(feedback);
    await page.getByTestId('demo-save-review-draft').click();
    await expect(page.getByTestId('demo-review-status')).toContainText(/borrador|Borrador|privad/);
    await teacherHome(page);
    // A saved provisional draft must leave the submitted task in the queue.
    await expect(page.getByTestId('dashboard-result-demo-example')).toBeVisible();
    await openExampleReview(page);
    await expect(page.getByTestId('demo-review-score-evidence')).toHaveValue('2');
    await expect(page.getByTestId('demo-review-feedback')).toHaveValue(feedback);
    await expect(page.getByTestId('demo-review-total')).toContainText('7/12');
    await page.getByTestId('demo-validate-review').click();
    await expect(page.getByTestId('demo-review-status')).toContainText(/validada|Validada|revisada|Revisada/);
    await teacherHome(page);
    await expect(page.getByTestId('dashboard-result-demo-example')).toHaveCount(0);

    for (const section of ['groups', 'activities', 'assignments', 'results', 'sheets']) {
      await page.getByTestId(`nav-${section}`).click();
      await expect(page.locator('.workspace-shell')).toBeVisible();
      await fits(page, `Sección docente ${section}`);
    }
    await logout(page);
    await login(page, 'student');
    await expect(page.getByTestId('nav-groups')).toHaveCount(0);
    await expect(page.getByTestId('demo-review-feedback')).toHaveCount(0);
    await expect(page.locator('.workspace-main')).not.toContainText(feedback);
    await expect(page.getByTestId('open-assignment-demo-assignment')).toBeVisible();
    await fits(page, 'Panel estudiante nuevo');
    await page.screenshot({ path: `${artifactDir}/LectorLab_2_0_Panel_Estudiante_Actualizado${viewport.width === 390 ? '_Movil' : ''}.png`, fullPage: true });
    await page.getByTestId('open-assignment-demo-assignment').click();
    const initial = `Borrador ${viewport.width}: sostener una inferencia con citas.`;
    await page.getByTestId('initial').fill(initial);
    // Immediate navigation must flush pending changes without waiting for debounce.
    await page.locator('.brand').click();
    await page.waitForFunction(() => document.querySelector('[data-testid="open-assignment-demo-assignment"]') || document.querySelector('[data-testid="entry-student"]'));
    if (await page.getByTestId('entry-student').isVisible()) await login(page, 'student');
    await page.getByTestId('open-assignment-demo-assignment').click();
    await expect(page.getByTestId('initial')).toHaveValue(initial);
    await expect(page.getByTestId('save-status')).toHaveText('Conservado en esta pestaña');
    await page.getByTestId('next-step').click();
    await expect(page.locator('.reading-text')).toBeVisible();
    await fits(page, 'Lector estudiante');
    await page.screenshot({ path: `${artifactDir}/LectorLab_2_0_Lector_Estudiante_Actualizado${viewport.width === 390 ? '_Movil' : ''}.png`, fullPage: true });
    await logout(page);
    assert.deepEqual(errors, [], 'Sin errores JavaScript');
    assert.deepEqual(prohibited, [], 'Sin API real, POST ni conexiones externas');
    assert.deepEqual(failures, [], 'Sin recursos perdidos ni errores HTTP');
    const result = { viewport: `${viewport.width}x${viewport.height}`, status: 'PASS', checked: ['bienvenida intacta', 'panel docente nuevo y navegación', 'editor 4 pasos sin perder cambios', 'rúbrica editable de ejemplo y total', 'publicación solo tras revisión', 'propuesta ficticia 8/12 y ajustes', 'borrador privado separado de validación', 'panel y lectura estudiante con guardado', 'sin API, POST, errores JS ni desbordes'] };
    results.push(result);
    console.log(`PASS ${viewport.width}px: panel, editor, rúbrica y revisión; recorrido estudiante conservado.`);
    await context.close();
  }
  await writeFile(join(artifactDir, 'validacion-redisenio-interno.json'), JSON.stringify({ method: 'Chromium y servidor exclusivamente estático bajo prefijo de Pages', results }, null, 2) + '\n');
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser?.close();
  server.closeAllConnections();
  await new Promise(resolveClose => server.close(resolveClose));
}
