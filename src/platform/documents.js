import express from 'express';
import multer from 'multer';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { activityDto, insertActivity, ownedActivity, updateActivity } from './activities.js';
import { validateGeneratedQuestions, validateGenerationRequest } from './generation.js';

const MAX_FILE = 2 * 1024 * 1024;
const MAX_EXPANDED = 8 * 1024 * 1024;
const MAX_TEXT = 40_000;
const EXTRACTION_MS = 15_000;
let activeExtractions = 0;
const mimeByExtension = {
  '.txt': ['text/plain', 'application/octet-stream'],
  '.pdf': ['application/pdf', 'application/octet-stream'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/octet-stream'],
};
function problem(status, message, code) { return Object.assign(new Error(message), { status, code }); }

export function canonicalText(value) {
  return value.normalize('NFC').replace(/\r\n?/gu, '\n').replace(/\u0000/gu, '').trim();
}

/** Inspect DOCX entries before a parser can decompress them. Nothing is extracted to disk. */
async function inspectDocx(buffer) {
  const { default: yauzl } = await import('yauzl');
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true, validateEntrySizes: true, strictFileNames: true }, (openError, zip) => {
      if (openError) return reject(problem(422, 'El DOCX no contiene un archivo ZIP válido.'));
      let entries = 0, expanded = 0, settled = false;
      const names = new Set();
      const fail = error => {
        if (settled) return;
        settled = true;
        zip.close();
        reject(error.status ? error : problem(422, 'No se pudo revisar la estructura del DOCX.'));
      };
      zip.on('error', fail);
      zip.on('entry', entry => {
        entries++;
        expanded += entry.uncompressedSize;
        const name = entry.fileName;
        if (entries > 100 || expanded > MAX_EXPANDED || entry.uncompressedSize > MAX_EXPANDED
          || (entry.uncompressedSize > 64 * 1024 && entry.uncompressedSize / Math.max(1, entry.compressedSize) > 100)
          || (entry.generalPurposeBitFlag & 1) || name.startsWith('/') || name.split('/').includes('..')
          || /(?:vbaProject|macros|activeX|embeddings)(?:\.|\/)/iu.test(name) || names.has(name)) {
          fail(problem(422, 'El DOCX contiene elementos no permitidos, cifrado o una expansión excesiva.'));
          return;
        }
        names.add(name);
        if (!/\.rels$/iu.test(name)) { zip.readEntry(); return; }
        if (entry.uncompressedSize > 256 * 1024) { fail(problem(422, 'Las relaciones del DOCX exceden el límite.')); return; }
        zip.openReadStream(entry, (streamError, stream) => {
          if (streamError) { fail(streamError); return; }
          const chunks = [];
          let size = 0;
          stream.on('error', fail);
          stream.on('data', chunk => {
            size += chunk.length;
            if (size > 256 * 1024) { stream.destroy(); fail(problem(422, 'El DOCX excede los límites de lectura.')); return; }
            chunks.push(chunk);
          });
          stream.on('end', () => {
            if (settled) return;
            if (/TargetMode\s*=\s*["']External["']/iu.test(Buffer.concat(chunks).toString('utf8'))) {
              fail(problem(422, 'El DOCX usa recursos externos. Guarda una copia sin enlaces externos para importarla.'));
              return;
            }
            zip.readEntry();
          });
        });
      });
      zip.on('end', () => {
        if (settled) return;
        settled = true;
        if (!names.has('[Content_Types].xml') || !names.has('word/document.xml')) {
          reject(problem(422, 'El archivo ZIP no es un documento DOCX.'));
        } else resolve();
      });
      zip.readEntry();
    });
  });
}

async function extractInWorker({ buffer, extension }) {
  let text;
  if (extension === '.txt') {
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(buffer); }
    catch { throw problem(422, 'Guarda el TXT con codificación UTF-8 antes de importarlo.'); }
    if (/[\x00-\x08\x0b\x0c\x0e-\x1f]/u.test(text)) throw problem(422, 'El TXT contiene datos binarios no permitidos.');
  } else if (extension === '.docx') {
    await inspectDocx(buffer);
    const { default: mammoth } = await import('mammoth');
    try { text = (await mammoth.extractRawText({ buffer })).value; }
    catch { throw problem(422, 'No se pudo extraer texto del DOCX. Comprueba que no esté cifrado o dañado.'); }
  } else {
    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({ data: new Uint8Array(buffer), isEvalSupported: false, disableFontFace: true, useSystemFonts: false });
    try {
      const info = await parser.getInfo();
      if (info.total > 80) throw problem(422, 'El PDF supera el límite de 80 páginas. Divide la lectura.');
      const result = await parser.getText();
      text = result.pages?.map(page => page.text).join('\n\n') ?? result.text;
    } catch (error) {
      if (error.status) throw error;
      throw problem(422, 'El PDF está cifrado, dañado o no permite extracción de texto.');
    } finally { await parser.destroy(); }
  }
  const normalized = canonicalText(text ?? '');
  if (!normalized) throw problem(422, extension === '.pdf'
    ? 'Este PDF no tiene texto extraíble. Requiere OCR; esta versión no interpreta imágenes.'
    : 'El documento no contiene texto extraíble.', extension === '.pdf' ? 'needs_ocr' : 'empty_text');
  if ([...normalized].length > MAX_TEXT) throw problem(422, 'La lectura supera 40 000 caracteres. Divide el documento antes de importarlo.');
  return normalized;
}

if (!isMainThread && workerData?.lectorlabExtraction) {
  try { parentPort.postMessage({ text: await extractInWorker({ ...workerData, buffer: Buffer.from(workerData.buffer) }) }); }
  catch (error) { parentPort.postMessage({ error: error.message, status: error.status || 422, code: error.code }); }
}

/** All parsing occurs in a disposable worker with CPU deadline and memory cap. */
export async function extractDocument({ buffer, filename, mime }) {
  if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > MAX_FILE) throw problem(413, 'Selecciona un documento de hasta 2 MB.');
  const extension = path.extname(filename || '').toLowerCase();
  if (!mimeByExtension[extension]?.includes(mime)) throw problem(415, 'Solo se admiten PDF, DOCX y TXT con su tipo de archivo correspondiente.');
  if (extension === '.pdf' && !buffer.subarray(0, 5).equals(Buffer.from('%PDF-'))) throw problem(415, 'La firma del archivo no corresponde a un PDF.');
  if (extension === '.docx' && !buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) throw problem(415, 'La firma del archivo no corresponde a un DOCX.');
  // A TXT has no magic signature. Reject common binary disguises before UTF-8 decoding.
  if (extension === '.txt' && (buffer.subarray(0, 5).equals(Buffer.from('%PDF-')) || buffer.subarray(0, 2).equals(Buffer.from('PK')))) {
    throw problem(415, 'El contenido no corresponde a texto plano.');
  }
  if (activeExtractions >= 2) throw problem(429, 'El servidor ya procesa dos documentos. Espera unos segundos antes de reintentar.');
  activeExtractions++;
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL(import.meta.url), {
      workerData: { lectorlabExtraction: true, buffer, extension },
      resourceLimits: { maxOldGenerationSizeMb: 160, maxYoungGenerationSizeMb: 32 },
    });
    let settled = false;
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.terminate().catch(() => {});
      if (error) reject(error); else resolve(result);
    };
    const timer = setTimeout(() => finish(problem(422, 'La extracción excedió el tiempo permitido. Divide o simplifica el documento.')), EXTRACTION_MS);
    worker.once('error', () => finish(problem(422, 'El documento no pudo procesarse dentro de los límites seguros.')));
    worker.once('exit', () => { if (!settled) finish(problem(422, 'La extracción terminó sin un texto válido.')); });
    worker.once('message', result => result.error
      ? finish(problem(result.status || 422, result.error, result.code)) : finish(null, result.text));
  }).finally(() => { activeExtractions--; });
}

function documentDto(row, includeText = true) {
  return { id: row.id, filename: row.filename, mime: row.mime, sha256: row.sha256,
    status: row.status, createdAt: row.created_at, ...(includeText ? { textContent: row.text_content } : {}) };
}
function uploadMiddleware(req, res, next) {
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE, files: 1, fields: 2, parts: 3 } }).single('file');
  upload(req, res, err => next(err ? problem(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400,
    err.code === 'LIMIT_FILE_SIZE' ? 'El archivo supera 2 MB.' : 'Envía un único documento en el campo file.') : undefined));
}

export function createDocumentsRouter({ db, auth, generator = null }) {
  const router = express.Router();
  router.use('/documents', auth.requireUser, auth.requireRole('teacher'));
  router.use('/activities/:id/generate', auth.requireUser, auth.requireRole('teacher'));
  const inflight = new Set();
  const generationBudget = new Map();
  function reserveGeneration(userId) {
    const now = Date.now();
    for (const [id, times] of generationBudget) {
      const active = times.filter(time => now - time < 60 * 60 * 1000);
      if (active.length) generationBudget.set(id, active); else generationBudget.delete(id);
    }
    const times = generationBudget.get(userId) || [];
    if (times.length >= 10) throw problem(429, 'Esta demostración admite diez solicitudes de generación por hora y docente. Revisa los borradores existentes.');
    if (!generationBudget.has(userId) && generationBudget.size >= 1000) generationBudget.delete(generationBudget.keys().next().value);
    generationBudget.set(userId, [...times, now]);
  }
  async function ownedDocument(user, id) {
    const { rows } = await db.query('SELECT * FROM documents WHERE id=$1 AND owner_id=$2', [id, user.id]);
    if (!rows[0]) throw problem(404, 'Documento no encontrado.');
    return rows[0];
  }
  router.get('/documents', async (req, res) => {
    const { rows } = await db.query('SELECT * FROM documents WHERE owner_id=$1 ORDER BY created_at DESC LIMIT 100', [req.user.id]);
    res.json({ documents: rows.map(row => documentDto(row, false)) });
  });
  router.post('/documents', auth.requireCsrf, uploadMiddleware, async (req, res) => {
    if (!req.file) throw problem(400, 'Selecciona un PDF, DOCX o TXT.');
    if (inflight.has(req.user.id)) throw problem(429, 'Ya hay una extracción o generación en curso. Espera a que termine.');
    inflight.add(req.user.id);
    try {
      const { rows: quota } = await db.query('SELECT COUNT(*)::int AS count FROM documents WHERE owner_id=$1', [req.user.id]);
      if (quota[0].count >= 100) throw problem(429, 'Esta primera versión admite hasta 100 documentos por docente. Reutiliza los textos ya importados.');
      const text = await extractDocument({ buffer: req.file.buffer, filename: req.file.originalname, mime: req.file.mimetype });
      const filename = path.basename(req.file.originalname).replace(/[\x00-\x1f\x7f]/gu, '').slice(0, 180) || 'documento';
      const { rows } = await db.query(`INSERT INTO documents(id,owner_id,filename,mime,sha256,text_content,status)
        VALUES($1,$2,$3,$4,$5,$6,'extracted') RETURNING *`, [randomUUID(), req.user.id, filename,
        req.file.mimetype, createHash('sha256').update(req.file.buffer).digest('hex'), text]);
      res.status(201).json({ document: documentDto(rows[0]), notice: 'Revisa el texto extraído antes de crear preguntas. Las posiciones de las citas se refieren a este texto, no al diseño del archivo original.' });
    } finally { inflight.delete(req.user.id); }
  });
  router.get('/documents/:id', async (req, res) => res.json({ document: documentDto(await ownedDocument(req.user, req.params.id)) }));
  router.post('/documents/:id/activity', auth.requireCsrf, async (req, res) => {
    const document = await ownedDocument(req.user, req.params.id);
    if (typeof req.body?.reviewedText !== 'string' || !req.body.reviewedText.trim()) {
      throw problem(400, 'Revisa y confirma el texto antes de crear la actividad.');
    }
    const readingText = canonicalText(req.body.reviewedText);
    if ([...readingText].length > MAX_TEXT) throw problem(400, 'El texto revisado supera 40 000 caracteres.');
    const activity = await insertActivity(db, req.user.id, { title: req.body.title || document.filename,
      readingText, questions: [], instructions: '', source: { documentId: document.id, filename: document.filename } });
    res.status(201).json({ activity: activityDto(activity, { teacher: true }) });
  });
  router.post('/activities/:id/generate', auth.requireCsrf, async (req, res) => {
    const request = validateGenerationRequest(req.body);
    const row = await ownedActivity(db, req.user.id, req.params.id);
    if (row.status !== 'draft') throw problem(409, 'La actividad publicada es inmutable. Crea una copia para editar.');
    if ([...row.reading_text].length > MAX_TEXT) throw problem(422, 'Divide la lectura en textos de hasta 40 000 caracteres antes de generar preguntas.');
    if (!generator) throw problem(503, 'La generación con IA no está configurada. Puedes redactar preguntas manualmente y revisarlas antes de publicar.');
    if (inflight.has(req.user.id)) throw problem(429, 'Ya hay una extracción o generación en curso. Espera a que termine.');
    reserveGeneration(req.user.id);
    inflight.add(req.user.id);
    try {
      const activity = activityDto(row, { teacher: true });
      const output = await generator({ text: row.reading_text, instructions: activity.instructions, ...request });
      const questions = validateGeneratedQuestions(output, activity, request);
      // updateActivity rechecks draft state under a transaction, including a
      // concurrent publication. Check reading hash too to avoid stale evidence.
      const updated = await updateActivity(db, req.user.id, req.params.id, { questions }, { expectedReadingHash: row.reading_hash });
      res.json({ activity: activityDto(updated, { teacher: true }), notice: 'Borrador generado. Revisa enunciados, claves, citas y justificación antes de publicar.' });
    } finally { inflight.delete(req.user.id); }
  });
  return router;
}
