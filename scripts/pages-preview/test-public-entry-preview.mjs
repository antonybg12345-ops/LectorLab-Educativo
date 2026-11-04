import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile, stat, mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { extname, resolve, sep, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Prueba la publicación como archivos estáticos bajo el prefijo de GitHub Pages.
// No importa Express, la API, la base de datos ni el servidor de la aplicación.
const require = createRequire(new URL('../../package.json', import.meta.url));
const { chromium, expect } = require('@playwright/test');
const repository = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const publicRoot = resolve(process.argv[2] || join(repository, 'dist/pages-preview'));
const artifactDir = resolve(process.argv[3] || join(repository, 'dist/pages-preview-test-artifacts'));
await mkdir(artifactDir, { recursive: true });
const prefix = '/LectorLab-Educativo/';
const entryPath = `${prefix}avance/`;
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const server = createServer(async (request, response) => {
  try {
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405, { Allow: 'GET, HEAD' }); response.end(); return;
    }
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (!pathname.startsWith(prefix)) {
      response.writeHead(404); response.end(); return;
    }
    let filename = resolve(publicRoot, pathname.slice(prefix.length));
    if (filename !== publicRoot && !filename.startsWith(publicRoot + sep)) {
      response.writeHead(404); response.end(); return;
    }
    if ((await stat(filename)).isDirectory()) filename = resolve(filename, 'index.html');
    const body = await readFile(filename);
    response.writeHead(200, {
      'Content-Type': mime[extname(filename).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch (error) {
    response.writeHead(error.code === 'ENOENT' || error.code === 'ENOTDIR' ? 404 : 500);
    response.end();
  }
});

server.listen(0, '127.0.0.1');
await once(server, 'listening');
const origin = `http://127.0.0.1:${server.address().port}`;
const entryUrl = origin + entryPath;
const results = [];
let browser;

function routePath(page) {
  return (new URL(page.url()).hash.slice(1) || '/').split('?')[0];
}

async function expectRoute(page, route) {
  await expect.poll(() => routePath(page)).toBe(route);
  assert.equal(new URL(page.url()).pathname, entryPath, 'La ruta pública permanece en avance/');
}

async function expectHome(page) {
  await expectRoute(page, '/');
  await expect(page.getByTestId('entry-teacher')).toBeVisible();
  await expect(page.getByTestId('entry-student')).toBeVisible();
  await expect(page.locator('.entry-portals [data-testid^="entry-"]')).toHaveCount(2);
  await expect(page.getByTestId('logout')).toHaveCount(0);
  // La elección visible se hace en los portales, sin los atajos de la demo antigua.
  for (const id of ['demo-teacher', 'demo-student', 'demo-tour']) {
    await expect(page.getByTestId(id)).toHaveCount(0);
  }
}

async function expectAccess(page, role) {
  await expectRoute(page, `/ingresar/${role === 'teacher' ? 'docente' : 'estudiante'}`);
  const inputs = page.locator('input[data-testid^="auth-"]');
  await expect(inputs).toHaveCount(2);
  for (const id of ['auth-username', 'auth-password']) {
    await expect(page.getByTestId(id)).toBeVisible();
    await expect(page.getByTestId(id)).toBeDisabled();
    await expect(page.getByTestId(id)).toHaveValue('');
  }
  await expect(page.getByTestId('auth-password-toggle')).toBeDisabled();
  await expect(page.getByTestId('auth-submit')).toHaveText(
    `Abrir demostración ${role === 'teacher' ? 'docente' : 'estudiante'}`,
  );
  await expect(page.getByTestId('auth-submit')).toBeEnabled();
  await expect(page.locator('body')).toContainText(/fictici[oa]s?|memoria|RAM|simulad[oa]/i);
  await expect(page.getByTestId('logout')).toHaveCount(0);
}

async function expectFits(page, label) {
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    false,
    `${label}: sin desborde horizontal`,
  );
}

async function openDemo(page, role) {
  await page.getByTestId(`entry-${role}`).click();
  await expectAccess(page, role);
  // El formulario se abre vacío: la demostración nunca exige credenciales.
  await page.getByTestId('auth-submit').click();
  await expect(page.getByTestId('logout')).toBeVisible();
  await expectRoute(page, role === 'teacher' ? '/docente' : '/estudiante');
}

async function openAssignment(page) {
  await expect(page.getByTestId('open-assignment-demo-assignment')).toBeVisible();
  await page.getByTestId('open-assignment-demo-assignment').click();
  await expect(page.getByTestId('initial')).toBeVisible();
  await expectRoute(page, '/estudiante');
}

try {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined, headless: true });
  for (const viewport of [{ width: 1366, height: 900 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
    const errors = [], rejectedRequests = [], failedResponses = [], documentRequests = [];
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => {
      if (request.resourceType() === 'document') documentRequests.push(request.url());
    });
    page.on('response', response => {
      const url = new URL(response.url());
      if (response.status() >= 400 && url.pathname !== '/favicon.ico') {
        failedResponses.push({ url: response.url(), status: response.status() });
      }
    });
    // Un intento de API o escritura falla aunque el adaptador intente ocultarlo.
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      const http = ['http:', 'https:'].includes(url.protocol);
      const prohibited = http && (
        url.origin !== origin || /(?:^|\/)api(?:\/|$)/i.test(url.pathname) ||
        !['GET', 'HEAD'].includes(request.method()) ||
        (!url.pathname.startsWith(prefix) && url.pathname !== '/favicon.ico')
      );
      if (prohibited) {
        rejectedRequests.push({ method: request.method(), url: request.url() });
        await route.abort('blockedbyclient');
      } else await route.continue();
    });

    const initialResponse = await page.goto(entryUrl, { waitUntil: 'networkidle' });
    assert.equal(initialResponse.status(), 200, 'GET del enlace público devuelve 200');
    await expectHome(page);
    await expectFits(page, 'Bienvenida');
    await page.screenshot({
      path: `${artifactDir}/LectorLab_2_0_Avance_Web_${viewport.width === 390 ? 'Movil' : 'Escritorio'}.png`,
      fullPage: true,
    });

    const stylesheetUrls = await page.locator('link[rel="stylesheet"]').evaluateAll(
      elements => elements.map(element => element.href),
    );
    assert.ok(stylesheetUrls.length > 0, 'La página incluye sus hojas de estilo');
    for (const url of stylesheetUrls) {
      assert.ok(new URL(url).pathname.startsWith(prefix), `CSS respeta el prefijo: ${url}`);
      const response = await context.request.get(url);
      assert.equal(response.status(), 200, `CSS disponible: ${url}`);
      assert.match(response.headers()['content-type'], /text\/css/);
    }
    const image = page.locator('.entry-art img');
    await expect(image).toBeVisible();
    assert.ok(await image.evaluate(element => element.complete && element.naturalWidth > 0), 'La imagen se renderiza');
    const imageUrl = await image.getAttribute('src');
    const imageResponse = await context.request.get(new URL(imageUrl, page.url()).href);
    assert.equal(imageResponse.status(), 200, 'La ilustración está disponible bajo Pages');
    assert.match(imageResponse.headers()['content-type'], /image\//);

    for (const role of ['teacher', 'student']) {
      const previousDocuments = documentRequests.length;
      await page.getByTestId(`entry-${role}`).click();
      await expectAccess(page, role);
      assert.equal(documentRequests.length, previousDocuments, 'El portal navega por hash sin pedir otro HTML');
      await expectFits(page, `Portal ${role}`);
      const response = await page.reload({ waitUntil: 'networkidle' });
      assert.equal(response.status(), 200, 'Recargar la ruta del portal no produce 404');
      await expectAccess(page, role);
      await page.goBack({ waitUntil: 'networkidle' });
      await expectHome(page);

      await openDemo(page, role);
      if (role === 'teacher') {
        await expect(page.getByTestId('nav-groups')).toBeVisible();
        await expect(page.getByTestId('open-assignment-demo-assignment')).toHaveCount(0);
        await page.getByTestId('nav-groups').click();
        await expect(page.getByTestId('open-group-demo-group')).toBeVisible();
        await expectFits(page, 'Panel docente');
        await page.getByTestId('logout').click();
        await expectHome(page);
        continue;
      }

      await expect(page.getByTestId('nav-groups')).toHaveCount(0);
      await expectFits(page, 'Panel estudiante');
      await openAssignment(page);
      const firstIdea = `Idea inicial de demostración ${viewport.width}: volver al texto antes de concluir.`;
      await page.getByTestId('initial').fill(firstIdea);
      // Salir enseguida comprueba el guardado al navegar, sin esperar al debounce.
      await page.locator('.brand').click();
      await expect(page.getByTestId('initial')).toHaveCount(0);
      await page.waitForFunction(() =>
        document.querySelector('[data-testid="open-assignment-demo-assignment"]') ||
        document.querySelector('[data-testid="entry-student"]'),
      );
      if (await page.getByTestId('entry-student').isVisible()) {
        await expectHome(page);
        await openDemo(page, 'student');
      }
      await openAssignment(page);
      await expect(page.getByTestId('initial')).toHaveValue(firstIdea);

      const revisedIdea = `${firstIdea} La segunda pista requiere contrastar mi primera explicación.`;
      await page.getByTestId('initial').fill(revisedIdea);
      await page.getByTestId('logout').click();
      await expectHome(page);
      await openDemo(page, 'student');
      await openAssignment(page);
      await expect(page.getByTestId('initial')).toHaveValue(revisedIdea);
      await expect(page.getByTestId('save-status')).toHaveText('Conservado en esta pestaña');
      await expectFits(page, 'Recorrido estudiante');
      await page.getByTestId('logout').click();
      await expectHome(page);
    }

    assert.deepEqual(errors, [], 'Sin errores JavaScript');
    assert.deepEqual(rejectedRequests, [], 'Sin API real, POST, peticiones externas ni rutas fuera de Pages');
    assert.deepEqual(failedResponses, [], 'Los recursos y las rutas solicitados no devuelven errores HTTP');
    results.push({
      viewport: `${viewport.width}x${viewport.height}`,
      status: 'PASS',
      stylesheets: stylesheetUrls.length,
      checked: ['GET 200 y recursos locales', 'dos portales', 'hash, recarga y Atrás',
        'credenciales deshabilitadas', 'paneles docente y estudiante', 'salida a bienvenida',
        'guardado al volver al inicio y salir', 'borrador conservado en RAM sin recargar',
        'sin API real ni POST', 'sin errores JS ni desborde'],
    });
    console.log(`PASS ${viewport.width}px: enlace público, portales, paneles y borrador en RAM; sin API ni errores.`);
    await context.close();
  }
  console.log(JSON.stringify({ artifact: entryPath, method: 'Chromium y servidor estrictamente estático con prefijo Pages', results }, null, 2));
} finally {
  await browser?.close();
  server.closeAllConnections();
  await new Promise(resolveClose => server.close(resolveClose));
}
