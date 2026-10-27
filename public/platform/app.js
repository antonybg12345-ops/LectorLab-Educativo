import { api, setCsrf } from './api.js';
import { el, field, button, status, message, heading, show, busy } from './ui.js';
import { renderTeacher } from './teacher.js';
import { renderStudent } from './student.js';

const view = document.getElementById('view');
const account = document.getElementById('account');

async function start() {
  try {
    const session = await api('/auth/session');
    setCsrf(session.csrfToken);
    if (!session.user) return renderAuth(session.setupRequired);
    const user = session.user;
    account.replaceChildren(el('div', { class: 'account' }, el('span', {}, user.name || user.username, ' · ', user.role === 'teacher' ? 'Docente' : 'Estudiante'), button('Salir', async event => {
      await busy(event.currentTarget, async () => {
        try {
          if (window.lectorlabBeforeLeave && !(await window.lectorlabBeforeLeave())) return;
          await api('/auth/logout', { method: 'POST', body: {} });
          window.lectorlabDispose?.();
          setCsrf(''); history.replaceState(null, '', '/'); await start();
        } catch (error) { window.alert(error.message); }
      });
    }, { testid: 'logout', class: 'btn small' })));
    if (user.role === 'teacher') await renderTeacher(view, user);
    else await renderStudent(view, user);
  } catch (error) {
    const note = status(); message(note, error.message, true);
    show(view, ...heading('No se pudo abrir tu espacio', 'LectorLab'), note, button('Intentar de nuevo', start));
  }
}

function renderAuth(setup) {
  account.replaceChildren();
  const username = field('Usuario de acceso', { required: true, autocomplete: 'username', maxlength: 64, testid: 'auth-username' });
  const name = field('Nombre de uso o alias docente', { required: setup, autocomplete: 'nickname', maxlength: 100, testid: 'auth-name' });
  const password = field('Contraseña', { type: 'password', required: true, minlength: setup ? 10 : undefined, maxlength: 128, autocomplete: setup ? 'new-password' : 'current-password', testid: 'auth-password' });
  const note = status();
  const submit = el('button', { class: 'btn primary', type: 'submit', 'data-testid': 'auth-submit' }, setup ? 'Crear acceso docente' : 'Entrar');
  const form = el('form', { on: { submit: async event => {
    event.preventDefault();
    await busy(submit, async () => {
      try {
        await api(`/auth/${setup ? 'setup' : 'login'}`, { method: 'POST', body: { username: username.input.value.trim(), password: password.input.value, ...(setup ? { name: name.input.value.trim() } : {}) } });
        password.input.value = ''; await start();
      } catch (error) { message(note, error.message, true); }
    });
  } } }, username.node, setup && name.node, password.node, setup && el('p', { class: 'small' }, 'Usa al menos 10 caracteres. No hay contraseñas compartidas ni una cuenta predeterminada.'), note, el('div', { class: 'actions' }, submit));
  show(view, el('section', { class: 'auth' }, ...heading(setup ? 'Tu primer espacio docente' : 'Volvamos al texto.', 'LectorLab 2.0'), el('p', { class: 'intro' }, setup ? 'Crea el primer acceso para organizar grupos, revisar actividades y acompañar a tus estudiantes.' : 'Entra con el usuario y la contraseña de tu cuenta. Los estudiantes reciben sus accesos del docente.'), el('div', { class: 'panel' }, form), el('p', { class: 'small' }, 'Primera versión para pruebas con datos ficticios. No incluyas información personal de estudiantes durante la evaluación.')));
}

start();
