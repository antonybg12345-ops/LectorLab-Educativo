import { readFile, writeFile, copyFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repository = resolve(here, '../..');
const source = resolve(repository, 'public/platform');
const publication = resolve(process.argv[2] || resolve(repository, 'dist/pages-preview'));
const out = resolve(publication, 'avance');
async function readIfPresent(path) {
  try { return await readFile(path); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
const originalHome = await readIfPresent(resolve(publication, 'index.html'));
const originalV1 = await readIfPresent(resolve(publication, 'v1/index.html'));
const seed = JSON.parse(await readFile(resolve(here, 'seed.json'), 'utf8'));
const read = name => readFile(`${source}/${name}`, 'utf8');
const routeSource = value => value.replace(/^import .+;\s*$/gm, '').replace(/^export /gm, '')
  .replaceAll('crypto.randomUUID()', 'previewId()')
  .replaceAll('location.pathname', 'previewLocation.pathname').replaceAll('location.search', 'previewLocation.search')
  .replaceAll('history.pushState(', 'previewHistory.pushState(').replaceAll('history.replaceState(', 'previewHistory.replaceState(');
let teacher = routeSource(await read('teacher.js'));
let student = routeSource(await read('student.js'));
const ui = routeSource(await read('ui.js'));
let entry = routeSource(await read('entry.js'));
const app = routeSource(await read('app.js')).replace('renderTeacher(view, user, { isCurrent })', 'renderTeacher(view, user, { isCurrent, designPreview })');
const workspace = routeSource(await read('workspace.js'));
const previewDesign = await readFile(resolve(here, 'design-preview.js'), 'utf8');
entry = entry.replace('...attrs, href, on:', '...attrs, href: previewHref(href), on:')
  .replace('/platform/assets/reading-scene.png', './assets/reading-scene.png');
if (!entry.includes('href: previewHref(href)')) throw new Error('Los enlaces deben conservar la ruta de Pages.');
teacher = teacher
  .replace('Usar el recorrido original', 'Copiar actividad de ejemplo')
  .replace('La IA propone; tú revisas', 'Revisa actividades y evidencias de ejemplo')
  .replace('Comienza con el recorrido original o prepara tu propia lectura.', 'Comienza con el ejemplo o prepara una lectura ficticia.')
  .replace('Las claves de esta vista docente no se envían a estudiantes.', 'La plataforma con servidor reserva las claves al docente. Este archivo de demostración contiene claves de ejemplo inspeccionables.')
  .replace('Cada estudiante tiene su propia cuenta. Un código compartido no sustituye su identidad.', 'Puedes ensayar grupos y alias ficticios. Esta vista no crea cuentas reales.')
  .replace('Comunica el acceso de forma privada. No uses DNI, correos personales ni una contraseña común para el aula. La contraseña no se recupera desde el listado.', 'Usa únicamente alias ficticios. No se crean ni conservan contraseñas en esta demostración.')
  .replace('Crear acceso del estudiante', 'Añadir alias de ejemplo')
  .replace("testid: 'student-password'", "testid: 'student-password', disabled: true, placeholder: 'Sin contraseña en la demo'")
  .replace("event.currentTarget.textContent = visible ? 'Ocultar contraseña' : 'Mostrar contraseña'; }, { class: 'btn small' });", "event.currentTarget.textContent = visible ? 'Ocultar contraseña' : 'Mostrar contraseña'; }, { class: 'btn small', disabled: true });")
  .replace("testid: 'document-file' });", "testid: 'document-file', disabled: true });")
  .replace("'data-testid': 'upload-document' }, 'Extraer y revisar texto'", "'data-testid': 'upload-document', disabled: true }, 'Carga no disponible en esta demo'")
  .replace('Máximo 2 MB. Se extrae texto; un PDF escaneado necesita OCR y se informará si no hay texto extraíble. Revisa que tengas permiso para usar el contenido y que no incluya datos personales.', 'La carga de archivos requiere la aplicación con servidor. En esta vista puedes trabajar con el texto ficticio del ejemplo. El nuevo límite de 50 MB y la conservación del original siguen pendientes de implementación.')
  .replace("testid: 'generate-questions' });", "testid: 'generate-questions', disabled: true });")
  .replace('no hay generación simulada.', 'esta vista no genera preguntas.')
  .replace('No se ha configurado la credencial del servidor. Puedes usar Excel mientras tanto; no se finge una conexión.', 'Google no está conectado a esta demostración. Puedes descargar un CSV con los datos ficticios de la pestaña.')
  .replaceAll('Excel', 'CSV de ejemplo');
student = student
  .replace('Tus respuestas se guardan en tu cuenta.', 'Las respuestas de ejemplo se conservan solo en la memoria de esta pestaña y se reinician al recargar.')
  .replaceAll("'Guardado'", "'Conservado en esta pestaña'")
  .replace('La IA no está configurada en este servidor.', 'La IA no está conectada en esta demostración.')
  .replace('El tutor usa la lectura de esta actividad y tus intervenciones guardadas. Te pide pistas, vínculos y alternativas; no escribe la respuesta por ti.', 'En la plataforma con IA configurada, el tutor utiliza la lectura de la actividad. Aquí puedes consultar una guía fija, sin conversación de IA.')
  .replace('Entrega guardada el ', 'Entrega de ejemplo registrada el ')
  .replaceAll('Excel', 'CSV de ejemplo');
let adapter = await readFile(resolve(here, 'v2-demo-adapter.js'), 'utf8');
adapter = adapter.replace('async function api(path,', 'async function demoRequest(path,')
  .replace("link.download = filename.replace(/\\.xlsx$/i, '.csv');", "link.download = 'LectorLab_demo_' + filename.replace(/\\.xlsx$/i, '.csv');");
if (!adapter.includes('async function demoRequest(') || !adapter.includes("'LectorLab_demo_'")) throw new Error('Contrato del adaptador no válido.');

const bridge = `
const DEMO_SEED = ${JSON.stringify(seed)};
function previewId() { return 'preview-' + [...crypto.getRandomValues(new Uint8Array(12))].map(value => value.toString(16).padStart(2, '0')).join(''); }
function previewRoute() {
  const raw = window.location.hash.startsWith('#/') ? window.location.hash.slice(1) : '/';
  return new URL(raw.startsWith('/') && !raw.startsWith('//') ? raw : '/', 'https://preview.invalid');
}
const previewLocation = { get pathname() { return previewRoute().pathname; }, get search() { return previewRoute().search; } };
function previewHref(path) { return '#' + path; }
function previewAddress(path) { const url = new URL(window.location.href); url.hash = previewHref(path); return url; }
const previewHistory = {
  pushState(data, title, path) { window.history.pushState(data, title, previewAddress(path)); },
  replaceState(data, title, path) { window.history.replaceState(data, title, previewAddress(path)); },
};
let previewUser = null;
function setCsrf() { /* No session or CSRF token exists in the RAM-only demo. */ }
async function api(path, options = {}) {
  if (path === '/auth/session') return { user: previewUser ? structuredClone(previewUser) : null, setupRequired: false };
  if (path === '/auth/logout') { previewUser = null; return {}; }
  if (path === '/auth/login') {
    const role = previewLocation.pathname === '/ingresar/estudiante' ? 'student' : 'teacher';
    demoSetRole(role);
    previewUser = role === 'teacher'
      ? { id: 'preview-teacher', name: 'Docente de ejemplo', username: 'demo-docente', role }
      : { id: 'demo-student', name: 'Explorador 01', username: 'lector.demo', role };
    return { user: structuredClone(previewUser) };
  }
  if (path.startsWith('/auth/')) throw new Error('No hay registro o autenticación reales en esta demostración.');
  const result = await demoRequest(path, options);
  const lifecycle = path.match(/^\\/activities\\/([^/]+)\\/(publish|clone)$/);
  if (options.method === 'POST' && lifecycle) {
    if (lifecycle[2] === 'publish') designPreview.publishRubric(lifecycle[1]);
    else designPreview.cloneRubric(lifecycle[1], result.activity.id);
  }
  return result;
}
`;
const demoAccess = `
// A preview must never solicit a real username or password. These disabled
// fields explain the intended interface; the action only opens a sample role.
const productionAccess = renderAccess;
renderAccess = function(view, options) {
  productionAccess(view, options);
  view.querySelectorAll('input').forEach(input => { input.disabled = true; input.required = false; input.value = ''; input.placeholder = 'No se necesita en la demostración'; });
  const reveal = view.querySelector('[data-testid="auth-password-toggle"]');
  if (reveal) reveal.disabled = true;
  view.querySelector('[data-testid="auth-submit"]').textContent = 'Abrir demostración ' + (options.role === 'teacher' ? 'docente' : 'estudiante');
  view.querySelector('.entry-help').textContent = 'Aquí no necesitas usuario ni contraseña. Abrirás un espacio con datos ficticios.';
};
document.querySelector('.skip').addEventListener('click', event => { event.preventDefault(); document.getElementById('view').focus(); });
`;
const script = `(() => { 'use strict';\n${bridge}\n${ui}\n${workspace}\n${adapter}\n${previewDesign}\n${entry}\n${demoAccess}\n${teacher}\n${student}\n${app}\n})();`;
if (/^\s*(import|export) /m.test(script) || /\bfetch\s*\(/.test(script)) throw new Error('La vista pública no debe tener importaciones o peticiones API.');
let html = await read('index.html');
html = html.replace('<title>LectorLab 2.0 · Comunicación</title>', '<title>LectorLab 2.0 · Avance de la interfaz</title>')
  .replace('<meta name="referrer" content="same-origin">', `<meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'">`)
  .replaceAll('href="/platform/styles.css"', 'href="./styles.css?v=2"').replaceAll('href="/platform/entry.css"', 'href="./entry.css?v=2"')
  .replaceAll('href="/platform/workspace.css?v=2"', 'href="./workspace.css?v=2"')
  .replace('  <script type="module" src="/platform/app.js"></script>\n', '')
  .replace('class="brand" href="/"', 'class="brand" href="#/"')
  .replace('<body>', `<body>
<aside class="preview-notice" aria-label="Alcance de la demostración"><strong>Avance 2 · Panel y editor actualizados</strong><p>Demostración con datos ficticios: bienvenida, espacios docente y estudiante, preparación por pasos y validación de ejemplo. Sin cuentas reales ni IA conectada. Al recargar se reinician los cambios.</p></aside>`)
  .replace(/<details><summary>Privacidad y uso de esta primera versión<\/summary><p>[\s\S]*?<\/p><\/details>/, '<details><summary>Qué permite esta demostración</summary><p>Los cambios solo permanecen en esta pestaña. Usa alias ficticios. No se envían escritos a un servidor, OpenAI o Google. Los reportes son CSV de ejemplo. La autenticación real requiere ejecutar la aplicación con servidor. El tutor y la generación de preguntas requieren además un proveedor de IA configurado. Las rúbricas generadas por IA, la conservación del archivo original y la carga de 50 MB siguen pendientes de implementación.</p></details>')
  .replace('</body>', `<script>${script.replaceAll('</script', '<\\/script')}</script></body>`);
await mkdir(`${out}/assets`, { recursive: true });
await writeFile(`${out}/index.html`, html, { mode: 0o644 });
for (const file of ['styles.css', 'entry.css', 'workspace.css']) await copyFile(`${source}/${file}`, `${out}/${file}`);
await copyFile(`${source}/assets/reading-scene.png`, `${out}/assets/reading-scene.png`);
await writeFile(`${out}/preview.css`, '.preview-notice{font:14px/1.5 system-ui;max-width:1280px;margin:14px auto;padding:12px 20px;border:1px solid #dfc9ad;background:#fff9ed;color:#59452e;border-radius:10px}.preview-notice p{margin:4px 0 0}@media(max-width:760px){.preview-notice{margin:10px 12px;font-size:13px}}', { mode: 0o644 });
html = html.replace('<link rel="stylesheet" href="./entry.css?v=2">', '<link rel="stylesheet" href="./entry.css?v=2">\n<link rel="stylesheet" href="./preview.css?v=2">');
await writeFile(`${out}/index.html`, html, { mode: 0o644 });
if ((originalHome && !originalHome.equals(await readFile(`${publication}/index.html`))) || (originalV1 && !originalV1.equals(await readFile(`${publication}/v1/index.html`)))) throw new Error('Se modificó otra versión.');
console.log(JSON.stringify({ out, htmlBytes: Buffer.byteLength(html), sha256: createHash('sha256').update(html).digest('hex'), rootAndV1: 'intactos' }));
