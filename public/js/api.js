/** Same-origin requests with a finite wait; no credentials are stored here. */
async function post(path, payload, timeoutMs = 45_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(typeof data.error === 'string' ? data.error : 'No se pudo completar la solicitud.');
    }
    // Keep the deadline active while reading the response body as well.
    return path === '/api/export-xlsx' ? await response.blob() : await response.json();
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('El servicio está tardando demasiado. Puedes intentarlo otra vez.');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function askTutor(message, turn, history) {
  const data = await post('/api/lectorlab', { message, turn, history });
  if (typeof data.reply !== 'string' || !data.reply.trim()) throw new Error('El tutor no pudo generar una pregunta. Inténtalo otra vez.');
  return data.reply;
}

export function exportWorkbook(submission) {
  return post('/api/export-xlsx', submission);
}
