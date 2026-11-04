let csrfToken = '';
export function setCsrf(value) { csrfToken = value || ''; }
export async function api(path, { method = 'GET', body, timeout = 45_000, storeCsrf = true } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const multipart = body instanceof FormData;
    const response = await fetch(`/api/v1${path}`, {
      method, credentials: 'same-origin', signal: controller.signal,
      headers: { ...(!multipart && body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(method !== 'GET' && csrfToken ? { 'X-CSRF-Token': csrfToken } : {}) },
      ...(body !== undefined ? { body: multipart ? body : JSON.stringify(body) } : {}),
    });
    if (response.status === 204) return {};
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.error || data.message || (response.status === 401 ? 'La sesión terminó. Entra de nuevo para continuar.' : 'No se pudo completar la solicitud.'));
      error.status = response.status; throw error;
    }
    if (storeCsrf && data.csrfToken) setCsrf(data.csrfToken);
    return data;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('La solicitud está tardando demasiado. Tu escrito sigue aquí; comprueba el estado antes de reenviar.');
    throw error;
  } finally { clearTimeout(timer); }
}
export async function download(path, filename = 'LectorLab.xlsx') {
  const response = await fetch(`/api/v1${path}`, { credentials: 'same-origin' });
  if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || 'No se pudo descargar el archivo.'); }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a'); link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
