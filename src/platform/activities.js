import { randomUUID, createHash } from 'node:crypto';

export function fail(status, message) { throw Object.assign(new Error(message), { status }); }
export const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export function boundedText(value, max, name, required = false) {
  if (value === undefined && !required) return '';
  if (typeof value !== 'string') fail(400, `${name} debe ser texto.`);
  const text = value.normalize('NFC').trim();
  if ([...text].length > max || (required && !text)) fail(400, `${name} no es válido (máximo ${max} caracteres).`);
  return text;
}
const safeId = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(value)
  && !['__proto__', 'constructor', 'prototype'].includes(value);
function choices(input, name) {
  if (!Array.isArray(input) || input.length < 2 || input.length > 12) fail(400, `${name} requiere entre 2 y 12 elementos.`);
  const ids = new Set();
  return input.map(item => {
    if (!isRecord(item) || !safeId(item.id) || ids.has(item.id)) fail(400, `${name}: identificador inválido o repetido.`);
    ids.add(item.id);
    return { id: item.id, text: boundedText(item.text, 1000, name, true) };
  });
}
function evidenceList(input, reading, publish) {
  if (input === undefined && !publish) return [];
  if (!Array.isArray(input) || input.length > 8 || (publish && input.length === 0)) fail(400, 'Cada pregunta publicada necesita evidencia textual revisada.');
  const codepoints = [...reading];
  return input.map(item => {
    if (!isRecord(item)) fail(400, 'Evidencia no válida.');
    const quote = boundedText(item.quote, 2000, 'Cita', true);
    const reason = boundedText(item.reason ?? item.reasoningLink, 2000, 'Vínculo de la evidencia', publish);
    const { start, end } = item;
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > codepoints.length
      || codepoints.slice(start, end).join('') !== quote) fail(400, 'La cita y sus posiciones deben coincidir con esta versión exacta de la lectura.');
    return { quote, start, end, reason };
  });
}
export function validateActivity(input, { publish = false } = {}) {
  if (!isRecord(input)) fail(400, 'Actividad no válida.');
  const readingText = boundedText(input.readingText, 80000, 'Lectura', true);
  const title = boundedText(input.title, 180, 'Título', true);
  const instructions = boundedText(input.instructions, 4000, 'Instrucciones');
  if (!Array.isArray(input.questions) || input.questions.length > 30 || (publish && !input.questions.length)) fail(400, 'La actividad admite hasta 30 preguntas y necesita al menos una para publicar.');
  const ids = new Set();
  const questions = input.questions.map((item, index) => {
    if (!isRecord(item)) fail(400, 'Pregunta no válida.');
    const id = item.id || `q${index + 1}`;
    if (!safeId(id) || ids.has(id)) fail(400, 'El identificador de pregunta es inválido o está repetido.');
    ids.add(id);
    if (!['mcq', 'inferential', 'matching', 'completion'].includes(item.type)) fail(400, 'Tipo de pregunta no admitido.');
    const q = { id, type: item.type, prompt: boundedText(item.prompt, 2000, 'Enunciado', true), evidence: evidenceList(item.evidence, readingText, publish) };
    q.rubric = boundedText(item.rubric, 4000, 'Rúbrica');
    if (item.type === 'mcq') {
      q.options = choices(item.options, 'Alternativas');
      if (!q.options.some(option => option.id === item.correctAnswer)) fail(400, 'La clave debe ser una alternativa de esta pregunta.');
      q.correctAnswer = item.correctAnswer;
    } else if (item.type === 'completion') {
      const values = item.acceptedAnswers ?? (typeof item.correctAnswer === 'string' ? [item.correctAnswer] : []);
      if (!Array.isArray(values) || !values.length || values.length > 20) fail(400, 'El completado necesita variantes válidas revisadas.');
      q.acceptedAnswers = values.map(value => boundedText(value, 500, 'Variante válida', true));
    } else if (item.type === 'matching') {
      q.left = choices(item.left, 'Elementos de origen');
      q.right = choices(item.right, 'Elementos de destino');
      if (!isRecord(item.correctAnswer) || Object.keys(item.correctAnswer).length !== q.left.length) fail(400, 'La relación debe definir una correspondencia para cada elemento.');
      q.correctAnswer = {};
      for (const left of q.left) {
        const target = item.correctAnswer[left.id];
        if (!q.right.some(right => right.id === target)) fail(400, 'La correspondencia usa un destino ajeno a la pregunta.');
        q.correctAnswer[left.id] = target;
      }
    }
    q.feedback = {};
    if (isRecord(item.feedback)) {
      for (const [key, value] of Object.entries(item.feedback)) {
        if (key !== 'correct' && key !== 'default' && !q.options?.some(option => option.id === key)) continue;
        q.feedback[key] = boundedText(value, 1500, 'Retroalimentación');
      }
    }
    return q;
  });
  const source = {};
  if (isRecord(input.source)) {
    for (const field of ['filename', 'author', 'url', 'license', 'documentId']) if (typeof input.source[field] === 'string') source[field] = boundedText(input.source[field], 1000, `Fuente ${field}`);
  }
  return { title, readingText, instructions, questions, source };
}
export function activityDto(row, { teacher = false } = {}) {
  const content = row.content || {};
  return {
    id: row.id, title: row.title, readingText: row.reading_text, readingHash: row.reading_hash,
    instructions: content.instructions || '', status: row.status, version: row.version, parentId: row.parent_id,
    reviewedAt: row.reviewed_at, publishedAt: row.published_at, createdAt: row.created_at, source: row.source,
    questions: teacher ? content.questions || [] : (content.questions || []).map(q => {
      const publicQuestion = { id: q.id, type: q.type, prompt: q.prompt };
      for (const field of ['options', 'left', 'right']) if (q[field]) publicQuestion[field] = q[field].map(({ id, text }) => ({ id, text }));
      return publicQuestion;
    }),
  };
}
export async function ownedActivity(db, teacherId, id, lock = false) {
  const { rows } = await db.query(`SELECT * FROM activities WHERE id=$1 AND owner_id=$2${lock ? ' FOR UPDATE' : ''}`, [id, teacherId]);
  if (!rows[0]) fail(404, 'Actividad no encontrada.');
  return rows[0];
}
export async function insertActivity(db, teacherId, input, parent = null) {
  const data = validateActivity(input);
  const id = randomUUID();
  const content = { questions: data.questions, instructions: data.instructions, maxTurns: 5 };
  const { rows } = await db.query(`INSERT INTO activities(id,owner_id,title,reading_text,reading_hash,source,content,version,parent_id)
    VALUES($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9) RETURNING *`, [id, teacherId, data.title, data.readingText,
    createHash('sha256').update(data.readingText).digest('hex'), JSON.stringify(data.source), JSON.stringify(content), parent ? parent.version + 1 : 1, parent?.id || null]);
  return rows[0];
}
export async function updateActivity(db, teacherId, id, input, { expectedReadingHash } = {}) {
  return db.transaction(async tx => {
    const current = await ownedActivity(tx, teacherId, id, true);
    if (current.status !== 'draft') fail(409, 'La versión publicada es inmutable. Crea una copia para editar.');
    if (expectedReadingHash !== undefined && current.reading_hash !== expectedReadingHash) fail(409, 'La lectura cambió durante la generación. Revisa el texto y vuelve a generar.');
    const data = validateActivity({ ...activityDto(current, { teacher: true }), ...input });
    const { rows } = await tx.query(`UPDATE activities SET title=$3,reading_text=$4,reading_hash=$5,source=$6::jsonb,content=$7::jsonb,reviewed_at=NULL
      WHERE id=$1 AND owner_id=$2 RETURNING *`, [id, teacherId, data.title, data.readingText,
      createHash('sha256').update(data.readingText).digest('hex'), JSON.stringify(data.source), JSON.stringify({ questions: data.questions, instructions: data.instructions, maxTurns: 5 })]);
    return rows[0];
  });
}
export async function publishActivity(db, teacherId, id, reviewed) {
  if (reviewed !== true) fail(400, 'Confirma la revisión docente de texto, preguntas, claves y evidencias antes de publicar.');
  return db.transaction(async tx => {
    const current = await ownedActivity(tx, teacherId, id, true);
    if (current.status !== 'draft') fail(409, 'Esta versión ya está publicada.');
    validateActivity(activityDto(current, { teacher: true }), { publish: true });
    const { rows } = await tx.query(`UPDATE activities SET status='published',reviewed_at=NOW(),published_at=NOW() WHERE id=$1 AND owner_id=$2 RETURNING *`, [id, teacherId]);
    return rows[0];
  });
}
