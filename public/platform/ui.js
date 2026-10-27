let sequence = 0;
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (key === 'on') for (const [event, handler] of Object.entries(value)) node.addEventListener(event, handler);
    else if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'value') node.value = value ?? '';
    else if (key === 'checked' || key === 'disabled' || key === 'required' || key === 'selected' || key === 'open') node[key] = Boolean(value);
    else if (value !== null && value !== undefined && value !== false) node.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children.flat(Infinity)) if (child !== null && child !== undefined && child !== false) node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  return node;
}
export function button(label, handler, { primary = false, testid, ...attrs } = {}) {
  return el('button', { type: 'button', class: `btn${primary ? ' primary' : ''}`, ...(testid ? { 'data-testid': testid } : {}), ...attrs, on: { click: handler } }, label);
}
export function field(label, { tag = 'input', testid, ...attrs } = {}) {
  const id = attrs.id || `field-${++sequence}`;
  const input = el(tag, { id, ...(tag === 'input' ? { type: 'text' } : {}), ...attrs, ...(testid ? { 'data-testid': testid } : {}) });
  return { input, node: el('div', {}, el('label', { class: 'field', for: id }, label), input) };
}
export function status() { return el('p', { class: 'status', role: 'status', 'aria-live': 'polite' }); }
export function message(node, text, error = false) { node.textContent = text || ''; node.className = `status${error ? ' error' : ''}`; }
export function heading(title, eyebrow) { return [eyebrow && el('div', { class: 'eyebrow' }, eyebrow), el('h1', { tabindex: '-1' }, title)]; }
export function show(container, ...nodes) { container.replaceChildren(...nodes.flat(Infinity).filter(Boolean)); container.querySelector('h1,h2')?.focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: 'instant' }); }
export function empty(text) { return el('p', { class: 'empty' }, text); }
export function list(data, name) { if (Array.isArray(data)) return data; return data?.[name] || []; }
export function fmt(value) { if (!value) return '—'; const date = new Date(value); return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('es-PE', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Lima' }).format(date); }
export function pill(value) { return el('span', { class: `pill ${value}` }, ({ draft: 'Borrador', published: 'Publicada', submitted: 'Por revisar', in_progress: 'En curso', reviewed: 'Revisada' })[value] || value); }
export async function busy(node, fn) { const previous = node.disabled; node.disabled = true; try { return await fn(); } finally { node.disabled = previous; } }
