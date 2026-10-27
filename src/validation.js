const textLimits = { initial: 320, hypothesis: 340, posture: 420, evidence1: 220, evidence2: 220,
  reflection: 380, finalThought: 360, startedAt: 100, completedAt: 100 };

export class InputError extends Error {
  constructor(message) { super(message); this.status = 400; }
}

function record(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function text(value, limit, field) {
  if (value === undefined) return "";
  if (typeof value !== "string" || value.length > limit) {
    throw new InputError(`El campo ${field} debe ser texto de hasta ${limit} caracteres.`);
  }
  return value.trim();
}

/** Whitelist raw responses; never copy score/correct/criteria or arbitrary cell objects. */
export function validateSubmission(body) {
  if (!record(body)) throw new InputError("Envía un objeto con las respuestas del recorrido.");
  const output = {};
  for (const [field, limit] of Object.entries(textLimits)) output[field] = text(body[field], limit, field);
  const answers = body.answers ?? {};
  if (!record(answers)) throw new InputError("Las respuestas objetivas deben ser un objeto.");
  output.answers = {};
  for (const [id, answer] of Object.entries(answers)) {
    if (!/^q[1-6]$/.test(id) || !["a", "b", "c", null].includes(answer)) {
      throw new InputError("Una respuesta objetiva contiene un identificador o alternativa no válidos.");
    }
    output.answers[id] = answer;
  }
  const chat = body.chat ?? [];
  if (!Array.isArray(chat) || chat.length > 5) throw new InputError("El diálogo debe contener como máximo cinco intervenciones.");
  output.chat = chat.map((turn) => {
    if (!record(turn)) throw new InputError("Cada intervención debe ser un objeto de texto.");
    return { student: text(turn.student, 500, "chat.student"), lectorlab: text(turn.lectorlab, 650, "chat.lectorlab") };
  });
  return output;
}

/** Bounded legacy contract, not an authoritative session/history. */
export function validateTutor(body, maxTurns) {
  if (!record(body)) throw new InputError("Envía un mensaje de texto.");
  const message = text(body.message, 500, "message");
  if (!message) throw new InputError("Escribe una idea antes de enviarla.");
  const turn = body.turn;
  if (!Number.isInteger(turn) || turn < 1 || turn > maxTurns) throw new InputError(`La conversación admite entre 1 y ${maxTurns} intervenciones.`);
  const history = body.history ?? [];
  if (!Array.isArray(history) || history.length > 10) throw new InputError("El historial es demasiado extenso o no es válido.");
  return { message, turn, history: history.map((item) => {
    if (!record(item) || !["user", "assistant"].includes(item.role)) throw new InputError("El historial contiene un rol no válido.");
    const content = text(item.content, 650, "history.content");
    if (!content) throw new InputError("El historial contiene texto vacío.");
    return { role: item.role, content };
  }) };
}
