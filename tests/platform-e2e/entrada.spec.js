import { test as base, expect } from '@playwright/test';

const teacher = { username: 'docente-e2e', password: 'Docente_E2E_2026!', name: 'Docente de prueba' };

const test = base.extend({
  page: async ({ page, baseURL }, use) => {
    const errors = [], externalRequests = [];
    const origin = new URL(baseURL).origin;
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => {
      if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== origin) externalRequests.push(request.url());
    });
    await page.route('https://**/*', route => route.abort());
    await use(page);
    expect(errors, 'La entrada no debe emitir errores JavaScript').toEqual([]);
    expect(externalRequests, 'La bienvenida y los accesos deben funcionar sin recursos de terceros').toEqual([]);
  },
});

async function jsonResponse(response, expected = 200) {
  expect(response.status(), await response.text()).toBe(expected);
  return response.json();
}

// The in-memory E2E installation has one first teacher shared by the browser
// projects. Reuse the same fixture as the full platform journey, never a real key.
async function teacherSession(page) {
  const session = await jsonResponse(await page.request.get('/api/v1/auth/session'));
  if (session.user?.username === teacher.username) return session;
  if (session.setupRequired) return jsonResponse(await page.request.post('/api/v1/auth/setup', { data: teacher }), 201);
  return jsonResponse(await page.request.post('/api/v1/auth/login', {
    data: { username: teacher.username, password: teacher.password },
  }));
}

async function logoutRequest(page, csrfToken) {
  await jsonResponse(await page.request.post('/api/v1/auth/logout', {
    headers: { 'X-CSRF-Token': csrfToken }, data: {},
  }));
}

async function noHorizontalOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), 'La pantalla debe caber en el viewport').toBe(false);
}

test('bienvenida, accesos y páginas informativas mantienen rutas, recarga y navegación Atrás', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('entry-teacher')).toBeVisible();
  await expect(page.getByTestId('entry-student')).toBeVisible();
  await expect(page.locator('h1')).toContainText('Lee, piensa');
  await expect(page.locator('#view')).not.toContainText('Lectura con propósito');
  await expect(page.locator('#view')).not.toContainText('Argumentos con evidencias');
  await expect(page.locator('#view')).not.toContainText('Retroalimentación para mejorar');
  await noHorizontalOverflow(page);

  await page.getByTestId('entry-student').click();
  await expect(page).toHaveURL(/\/ingresar\/estudiante$/);
  await expect(page.getByTestId('auth-username')).toHaveValue('');
  await expect(page.getByTestId('auth-password')).toHaveValue('');
  await expect(page.getByTestId('auth-name')).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId('auth-username')).toBeVisible();
  await page.goBack();
  await expect(page.getByTestId('entry-student')).toBeVisible();
  await page.getByTestId('entry-teacher').click();
  await expect(page).toHaveURL(/\/ingresar\/docente$/);
  const session = await jsonResponse(await page.request.get('/api/v1/auth/session'));
  await expect(page.getByTestId('auth-name')).toHaveCount(session.setupRequired ? 1 : 0);
  await noHorizontalOverflow(page);
  await page.getByTestId('entry-home').click();
  await expect(page.getByTestId('entry-student')).toBeVisible();

  await page.getByTestId('entry-how').click();
  await expect(page).toHaveURL(/\/como-funciona$/);
  await expect(page.locator('#view h1')).toBeVisible();
  await expect(page.locator('#view')).toContainText(/lectura|evidencia/i);
  await page.reload();
  await expect(page.locator('#view h1')).toBeVisible();
  await noHorizontalOverflow(page);
  await page.getByTestId('entry-home').click();
  await page.getByTestId('entry-about').click();
  await expect(page).toHaveURL(/\/acerca-de$/);
  await expect(page.locator('#view')).toContainText(/secundaria|Comunicación/i);
  await noHorizontalOverflow(page);
});

test('acceso muestra u oculta la contraseña y un error de credenciales no crea sesión', async ({ page }, info) => {
  const session = await teacherSession(page);
  await logoutRequest(page, session.csrfToken);
  await page.goto('/ingresar/docente');
  await expect(page.getByTestId('auth-password')).toHaveAttribute('type', 'password');
  await expect(page.getByTestId('auth-password-toggle')).toHaveAttribute('aria-pressed', 'false');
  await page.getByTestId('auth-password-toggle').click();
  await expect(page.getByTestId('auth-password')).toHaveAttribute('type', 'text');
  await expect(page.getByTestId('auth-password-toggle')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('auth-password-toggle').click();
  await expect(page.getByTestId('auth-password')).toHaveAttribute('type', 'password');
  const username = `missing-${info.project.name}`;
  await page.getByTestId('auth-username').fill(username);
  await page.getByTestId('auth-password').fill('Contraseña_ficticia_errónea');
  await page.getByTestId('auth-submit').click();
  await expect(page.locator('#view')).toContainText('Usuario o contraseña no válidos.');
  await expect(page.getByTestId('auth-username')).toHaveValue(username);
  await expect(page.getByTestId('auth-submit')).toBeEnabled();
  expect((await jsonResponse(await page.request.get('/api/v1/auth/session'))).user).toBeNull();
  await noHorizontalOverflow(page);
});

test('el acceso bloquea envíos duplicados mientras se autentica y Salir vuelve a bienvenida', async ({ page }) => {
  const session = await teacherSession(page);
  await logoutRequest(page, session.csrfToken);
  await page.goto('/ingresar/docente');
  let loginRequests = 0, release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/api/v1/auth/login', async route => {
    loginRequests++;
    await gate;
    await route.continue();
  });
  await page.getByTestId('auth-username').fill(teacher.username);
  await page.getByTestId('auth-password').fill(teacher.password);
  try {
    await page.getByTestId('auth-submit').click();
    await expect.poll(() => loginRequests).toBe(1);
    await expect(page.getByTestId('auth-submit')).toBeDisabled();
    await page.locator('form').dispatchEvent('submit');
    expect(loginRequests).toBe(1);
  } finally { release(); }
  await expect(page.getByTestId('logout')).toBeVisible();
  expect(loginRequests).toBe(1);
  await expect(page.getByTestId('nav-groups')).toBeVisible();
  await page.getByTestId('logout').click();
  await expect(page.getByTestId('entry-teacher')).toBeVisible();
  await expect(page.getByTestId('entry-student')).toBeVisible();
  await expect(page.getByTestId('auth-password')).toHaveCount(0);
});

test('una carga docente tardía no vuelve a pintar datos después de Salir', async ({ page }) => {
  const session = await teacherSession(page);
  await logoutRequest(page, session.csrfToken);
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/api/v1/groups', async route => {
    const response = await route.fetch();
    await gate;
    await route.fulfill({ response });
  });
  await page.goto('/ingresar/docente');
  await page.getByTestId('auth-username').fill(teacher.username);
  await page.getByTestId('auth-password').fill(teacher.password);
  await page.getByTestId('auth-submit').click();
  await expect(page.getByTestId('logout')).toBeVisible();
  await page.getByTestId('logout').click();
  await expect(page.getByTestId('entry-teacher')).toBeVisible();
  const lateResponse = page.waitForResponse(response => response.url().endsWith('/api/v1/groups'));
  release();
  await lateResponse;
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect(page.getByTestId('entry-teacher')).toBeVisible();
  await expect(page.getByTestId('nav-groups')).toHaveCount(0);
  await expect(page).toHaveURL(/\/$/);
  expect((await jsonResponse(await page.request.get('/api/v1/auth/session'))).user).toBeNull();
});

test('entrar por el portal docente no cambia el rol de una cuenta estudiante', async ({ page }, info) => {
  const session = await teacherSession(page);
  const headers = { 'X-CSRF-Token': session.csrfToken };
  const suffix = info.project.name.replace(/[^a-z0-9]/g, '-');
  const { group } = await jsonResponse(await page.request.post('/api/v1/groups', {
    headers, data: { name: `Grupo entrada ${suffix}`, grade: '4.º secundaria' },
  }), 201);
  const student = { username: `entry-lector-${suffix}`, name: `Lector entrada ${suffix}`, password: 'Estudiante_Entrada_2026!' };
  await jsonResponse(await page.request.post(`/api/v1/groups/${group.id}/students`, { headers, data: student }), 201);
  await logoutRequest(page, session.csrfToken);

  await page.goto('/ingresar/docente');
  await page.getByTestId('auth-username').fill(student.username);
  await page.getByTestId('auth-password').fill(student.password);
  const [request] = await Promise.all([
    page.waitForRequest(request => request.method() === 'POST' && request.url().endsWith('/api/v1/auth/login')),
    page.getByTestId('auth-submit').click(),
  ]);
  expect(request.postDataJSON()).toEqual({ username: student.username, password: student.password });
  await expect(page.getByTestId('logout')).toBeVisible();
  await expect(page).toHaveURL(/\/estudiante(?:\?.*)?$/);
  await expect(page.locator('#view')).toContainText(student.name);
  await expect(page.getByTestId('nav-groups')).toHaveCount(0);
  const authenticated = await jsonResponse(await page.request.get('/api/v1/auth/session'));
  expect(authenticated.user.role).toBe('student');
  expect((await page.request.get('/api/v1/groups')).status()).toBe(403);
  expect(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length }))).toEqual({ local: 0, session: 0 });

  await page.reload();
  await expect(page.locator('#view')).toContainText(student.name);
  expect((await jsonResponse(await page.request.get('/api/v1/auth/session'))).user.role).toBe('student');
  await page.getByTestId('logout').click();
  await expect(page.getByTestId('entry-student')).toBeVisible();
  expect((await jsonResponse(await page.request.get('/api/v1/auth/session'))).user).toBeNull();
});
