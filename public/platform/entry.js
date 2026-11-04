import { el, field, status, message, show } from './ui.js';

export function entryLink(label, href, navigate, attrs = {}) {
  return el('a', { ...attrs, href, on: { click: event => {
    if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); navigate(href);
  } } }, label);
}

function icon(name) {
  const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg');
  for (const [key, value] of Object.entries({ viewBox: '0 0 48 48', fill: 'none', stroke: 'currentColor', 'stroke-width': 2.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false' })) svg.setAttribute(key, value);
  const paths = {
    book: ['M24 12C18 8 10 7 4 10v29c7-3 14-2 20 2 6-4 13-5 20-2V10c-6-3-14-2-20 2Z', 'M24 12v29'],
    teacher: ['M6 9h36v25H6Z', 'M24 3v6M15 45l9-11 9 11M13 17h22M13 24h15'],
    arrow: ['M8 24h31M28 13l11 11-11 11'],
    eye: ['M3 24s8-13 21-13 21 13 21 13-8 13-21 13S3 24 3 24Z', 'M24 18a6 6 0 1 0 0 12 6 6 0 0 0 0-12Z'],
  };
  for (const d of paths[name] || paths.book) { const path = document.createElementNS(ns, 'path'); path.setAttribute('d', d); svg.append(path); }
  return svg;
}

export function renderEntryHeader(account, navigate, path) {
  account.replaceChildren(el('nav', { class: 'entry-nav', 'aria-label': 'Navegación de entrada' }, ...(path === '/' ? [
    entryLink('Cómo funciona', '/como-funciona', navigate, { class: 'entry-nav-link', 'data-testid': 'entry-how' }),
    entryLink('Acerca de', '/acerca-de', navigate, { class: 'entry-nav-link', 'data-testid': 'entry-about' }),
  ] : [entryLink('← Volver al inicio', '/', navigate, { class: 'entry-nav-link', 'data-testid': 'entry-home' })])));
}

export function renderWelcome(view, navigate) {
  const portal = (role, title, text) => entryLink([
    el('span', { class: 'entry-portal-icon' }, icon(role === 'teacher' ? 'teacher' : 'book')),
    el('div', { class: 'entry-portal-copy' }, el('h2', {}, title), el('p', {}, text)),
    el('span', { class: 'entry-portal-action' }, `Ingresar como ${role === 'teacher' ? 'docente' : 'estudiante'}`, icon('arrow')),
  ], role === 'teacher' ? '/ingresar/docente' : '/ingresar/estudiante', navigate, { class: 'entry-portal', 'data-testid': `entry-${role}` });
  show(view, el('section', { class: 'entry-welcome' },
    el('div', { class: 'entry-hero' },
      el('div', { class: 'entry-copy' }, el('p', { class: 'entry-eyebrow' }, 'Comunicación · Secundaria'),
        el('h1', { tabindex: '-1' }, 'Lee, piensa ', el('span', { class: 'entry-highlight' }, 'y sustenta.')),
        el('p', { class: 'entry-lead' }, 'Construye tus ideas con evidencias y aprende a revisar lo que piensas.')),
      el('div', { class: 'entry-art' }, el('img', { src: '/platform/assets/reading-scene.png', width: 1752, height: 897, alt: 'Dos estudiantes ilustrados leen un libro y anotan sus ideas.' }))),
    el('div', { class: 'entry-portals', 'aria-label': 'Elige tu acceso' },
      portal('teacher', 'Soy docente', 'Prepara lecturas, acompaña procesos y revisa evidencias.'),
      portal('student', 'Soy estudiante', 'Lee, explora pistas y sustenta tu interpretación.'))));
}

export function renderAccess(view, { role, setup, navigate, authenticate }) {
  const teacher = role === 'teacher';
  const username = field('Usuario', { required: true, autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false', maxlength: 40, testid: 'auth-username', placeholder: 'Tu usuario' });
  const name = setup ? field('Nombre de uso o alias docente', { required: true, autocomplete: 'nickname', maxlength: 80, testid: 'auth-name' }) : null;
  const password = field('Contraseña', { type: 'password', required: true, minlength: setup ? 10 : undefined, maxlength: 128, autocomplete: setup ? 'new-password' : 'current-password', testid: 'auth-password', placeholder: 'Tu contraseña' });
  const toggle = el('button', { type: 'button', class: 'entry-password-toggle', 'aria-label': 'Mostrar contraseña', 'aria-pressed': 'false', 'aria-controls': password.input.id, 'data-testid': 'auth-password-toggle', on: { click: () => {
    const visible = password.input.type === 'password'; password.input.type = visible ? 'text' : 'password';
    toggle.setAttribute('aria-label', visible ? 'Ocultar contraseña' : 'Mostrar contraseña'); toggle.setAttribute('aria-pressed', String(visible));
  } } }, icon('eye'));
  password.input.remove(); password.node.append(el('div', { class: 'entry-password' }, password.input, toggle));
  const note = status(); note.tabIndex = -1;
  const submitText = setup ? 'Crear acceso docente' : 'Ingresar';
  const submit = el('button', { type: 'submit', class: 'btn primary', 'data-testid': 'auth-submit' }, submitText);
  let submitting = false;
  const form = el('form', { class: 'entry-auth-form', on: { submit: async event => {
    event.preventDefault();
    if (submitting || !form.reportValidity()) return;
    submitting = true; message(note, ''); form.setAttribute('aria-busy', 'true');
    const controls = [username.input, password.input, toggle, submit, ...(name ? [name.input] : [])];
    controls.forEach(control => { control.disabled = true; }); submit.textContent = setup ? 'Creando acceso…' : 'Ingresando…';
    try {
      await authenticate({ username: username.input.value.trim(), password: password.input.value, ...(name ? { name: name.input.value.trim() } : {}) }, setup);
      password.input.value = '';
    } catch (error) {
      if (form.isConnected) { message(note, error.message, true); note.focus({ preventScroll: true }); }
    } finally {
      submitting = false; form.removeAttribute('aria-busy'); controls.forEach(control => { control.disabled = false; }); submit.textContent = submitText;
    }
  } } }, username.node, name?.node, password.node,
  setup && el('p', { class: 'entry-note' }, 'Crea el primer acceso de esta instalación. Usa al menos 10 caracteres y una contraseña individual.'),
  note, el('div', { class: 'actions' }, submit));
  show(view, el('section', { class: 'entry-auth' },
    el('div', { class: 'entry-auth-card' },
      el('div', { class: 'entry-auth-heading' }, el('span', { class: 'entry-auth-icon' }, icon(teacher ? 'teacher' : 'book')),
        el('div', {}, el('h1', { tabindex: '-1' }, setup ? 'Tu primer espacio docente' : `Acceso ${teacher ? 'docente' : 'estudiante'}`),
          el('p', {}, setup ? 'Prepara tu acceso para organizar grupos y actividades.' : teacher ? 'Prepara lecturas y acompaña a tus estudiantes.' : 'Entra y continúa tu recorrido de lectura.'))),
      form, el('p', { class: 'entry-help' }, teacher ? 'Usa el usuario de tu cuenta docente.' : 'Tu docente te entrega tu usuario y contraseña.')),
    el('p', { class: 'entry-switch' }, teacher ? '¿Eres estudiante? ' : '¿Eres docente? ',
      entryLink(teacher ? 'Ir al acceso estudiante' : 'Ir al acceso docente', teacher ? '/ingresar/estudiante' : '/ingresar/docente', navigate))));
}

export function renderEntryInfo(view, path, navigate) {
  const how = path === '/como-funciona';
  show(view, el('section', { class: 'entry-info' }, el('h1', { tabindex: '-1' }, how ? 'Cómo funciona LectorLab' : 'Acerca de LectorLab'),
    ...(how ? [
      el('p', {}, 'Un recorrido de lectura, evidencias y revisión de las propias ideas.'),
      el('h2', {}, 'Para docentes'), el('p', {}, 'Organiza grupos y accesos individuales. Prepara una lectura, revisa las preguntas y sus evidencias, y publica la versión que usarán tus estudiantes.'),
      el('h2', {}, 'Para estudiantes'), el('p', {}, 'Consulta tus actividades, lee el texto y construye una interpretación con evidencias. Guarda tu avance y entrega tu producción para recibir una devolución.'),
      el('h2', {}, 'Acompañamiento y evaluación'), el('p', {}, 'Las preguntas objetivas se corrigen con la clave revisada. Las interpretaciones abiertas se valoran con una rúbrica docente. Si la institución habilita el tutor con IA, acompaña con preguntas socráticas y trabaja con el texto de la actividad.'),
    ] : [
      el('p', {}, 'LectorLab es un proyecto educativo para el área de Comunicación en secundaria del Perú.'),
      el('p', {}, 'Su propósito es fortalecer la comprensión inferencial, la argumentación basada en evidencias textuales y el pensamiento crítico.'),
      el('p', {}, 'Cambiar una interpretación ante nueva evidencia forma parte del aprendizaje. La plataforma no utiliza rankings públicos ni acusaciones automáticas de fraude.'),
    ]), entryLink('Volver al inicio', '/', navigate, { class: 'btn primary' })));
}
