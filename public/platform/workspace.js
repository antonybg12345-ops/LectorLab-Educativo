import { el, show } from './ui.js';

/** Shared visual frame. It does not establish a role or change API permissions. */
export function workspacePage(view, { title, intro, role = 'teacher', nav, section, actions }, ...content) {
  const student = role === 'student';
  const roleLabel = student ? 'Espacio estudiante' : 'Espacio docente';
  const sidebar = el('aside', { class: 'workspace-sidebar', 'aria-label': roleLabel },
    el('p', { class: 'workspace-role' }, workspaceIcon(student ? 'book' : 'teacher'), roleLabel),
    nav,
    el('div', { class: 'workspace-sidebar-note' },
      workspaceIcon('book'),
      el('strong', {}, 'Leer. Sustentar. Revisar.'),
      el('p', {}, student ? 'Tu interpretación crece cuando vuelves al texto.' : 'Acompaña ideas que se sostienen con evidencias.')));
  const main = el('div', { class: 'workspace-main' },
    el('header', { class: 'workspace-heading' },
      el('div', { class: 'workspace-heading-copy' },
        el('p', { class: 'workspace-location' }, roleLabel, section ? ` / ${section}` : ''),
        el('h1', { tabindex: '-1' }, title),
        intro && el('p', { class: 'intro' }, intro)),
      actions && el('div', { class: 'workspace-heading-actions' }, actions)),
    el('div', { class: 'workspace-page-content' }, content));
  const shell = el('div', { class: 'workspace-shell', 'data-workspace-role': role }, sidebar, main);
  show(view, shell);
  return shell;
}

/** Small local line icons; interface labels remain real, accessible text. */
export function workspaceIcon(name) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  for (const [key, value] of Object.entries({ viewBox: '0 0 32 32', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false', class: 'workspace-icon' })) svg.setAttribute(key, value);
  const shapes = {
    home: ['M3 14 16 3l13 11', 'M6 12v17h7v-9h6v9h7V12'],
    groups: ['M16 16a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z', 'M6 29v-4a10 10 0 0 1 20 0v4Z', 'M5 8a4 4 0 0 0 0 8M27 8a4 4 0 0 1 0 8M3 20a8 8 0 0 0-2 6v3h5M29 20a8 8 0 0 1 2 6v3h-5'],
    book: ['M16 7C11 3 5 3 2 5v23c5-2 9-1 14 2 5-3 9-4 14-2V5c-3-2-9-2-14 2Z', 'M16 7v23'],
    assignments: ['M7 3h15l5 5v8M7 3H4v26h14M22 3v6h6', 'M9 11h8M9 17h6M19 25l8-8 4 4-8 8h-4Z'],
    results: ['M4 29V17h5v12M13 29V10h5v19M22 29V3h5v26M2 29h28'],
    sheets: ['M5 3h22v26H5Z', 'M5 10h22M5 17h22M5 23h22M12 10v19M20 10v19'],
    check: ['M27 8 12 24l-7-7'],
    arrow: ['M5 16h22M20 9l7 7-7 7'],
    plus: ['M16 5v22M5 16h22'],
    teacher: ['M4 6h24v17H4Z', 'M16 2v4M10 30l6-7 6 7M9 12h14M9 17h9'],
  };
  for (const d of shapes[name] || shapes.book) {
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', d); svg.append(path);
  }
  return svg;
}
