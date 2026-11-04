import { api, setCsrf } from './api.js';
import { el, button, status, message, heading, show, busy } from './ui.js';
import { renderTeacher } from './teacher.js';
import { renderStudent } from './student.js';
import { renderEntryHeader, renderWelcome, renderAccess, renderEntryInfo } from './entry.js';

const view = document.getElementById('view');
const account = document.getElementById('account');
let renderVersion = 0, currentUser = null, studentReturnSearch = '';

function rememberStudentRoute() {
  if (!['/estudiante', '/ingresar/estudiante'].includes(location.pathname)) return;
  const input = new URLSearchParams(location.search), output = new URLSearchParams();
  const attempt = input.get('attempt');
  if (attempt && attempt.length <= 100) {
    output.set('attempt', attempt);
    if (/^[0-6]$/.test(input.get('paso') || '')) output.set('paso', input.get('paso'));
  }
  studentReturnSearch = output.size ? `?${output}` : '';
}

async function navigate(path) {
  if (window.lectorlabBeforeLeave && !(await window.lectorlabBeforeLeave())) return;
  window.lectorlabDispose?.();
  if (!path.startsWith('/ingresar/estudiante')) studentReturnSearch = '';
  history.pushState(null, '', path); await start();
}

async function start() {
  const version = ++renderVersion;
  rememberStudentRoute();
  try {
    // Late responses must not replace a newer session token or entry screen.
    const session = await api('/auth/session', { storeCsrf: false });
    if (version !== renderVersion) return;
    setCsrf(session.csrfToken);
    currentUser = session.user || null;
    document.body.classList.toggle('entry-mode', !currentUser);
    if (!currentUser) {
      let path = location.pathname;
      if (path === '/docente' || path === '/estudiante') {
        path = path === '/docente' ? '/ingresar/docente' : '/ingresar/estudiante';
        history.replaceState(null, '', path + (path.endsWith('/estudiante') ? studentReturnSearch : ''));
      }
      renderEntryHeader(account, navigate, path);
      if (path === '/como-funciona' || path === '/acerca-de') return renderEntryInfo(view, path, navigate);
      if (path === '/ingresar/docente' || path === '/ingresar/estudiante') {
        const role = path.endsWith('/docente') ? 'teacher' : 'student';
        return renderAccess(view, { role, setup: role === 'teacher' && session.setupRequired === true, navigate,
          authenticate: async (credentials, setup) => {
            await api(`/auth/${setup ? 'setup' : 'login'}`, { method: 'POST', body: credentials });
            await start();
          } });
      }
      return renderWelcome(view, navigate);
    }
    const user = currentUser;
    const target = user.role === 'teacher' ? '/docente' : `/estudiante${studentReturnSearch}`;
    if (location.pathname + location.search !== target) history.replaceState(null, '', target);
    account.replaceChildren(el('div', { class: 'account' }, el('span', {}, user.name || user.username, ' · ', user.role === 'teacher' ? 'Docente' : 'Estudiante'), button('Salir', async event => {
      await busy(event.currentTarget, async () => {
        try {
          if (window.lectorlabBeforeLeave && !(await window.lectorlabBeforeLeave())) return;
          await api('/auth/logout', { method: 'POST', body: {} });
          window.lectorlabDispose?.(); currentUser = null; studentReturnSearch = ''; setCsrf('');
          history.replaceState(null, '', '/'); await start();
        } catch (error) { window.alert(error.message); }
      });
    }, { testid: 'logout', class: 'btn small' })));
    const isCurrent = () => version === renderVersion && currentUser?.id === user.id;
    if (user.role === 'teacher') await renderTeacher(view, user, { isCurrent });
    else await renderStudent(view, user, { isCurrent });
  } catch (error) {
    if (version !== renderVersion) return;
    const note = status(); message(note, error.message, true);
    show(view, ...heading('No se pudo abrir tu espacio', 'LectorLab'), note, button('Intentar de nuevo', start));
  }
}

document.querySelector('.brand').addEventListener('click', event => {
  if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault(); navigate('/');
});
window.addEventListener('popstate', async () => {
  const previousLocation = window.lectorlabCurrentLocation?.() || (currentUser?.role === 'teacher' ? '/docente' : '/estudiante');
  if (window.lectorlabBeforeLeave && !(await window.lectorlabBeforeLeave())) {
    history.pushState(null, '', previousLocation); return;
  }
  window.lectorlabDispose?.(); await start();
});

start();
