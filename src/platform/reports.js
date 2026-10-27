import express from 'express';
import ExcelJS from 'exceljs';
import { fail } from './activities.js';

export async function reportRecords(db, user, { attemptId, groupId } = {}) {
  if (groupId) {
    if (user.role !== 'teacher') fail(403, 'Solo el docente puede exportar un grupo.');
    const { rows } = await db.query('SELECT id FROM groups WHERE id=$1 AND owner_id=$2', [groupId, user.id]);
    if (!rows.length) fail(404, 'Grupo no encontrado.');
  }
  const { rows } = await db.query(`SELECT t.*, u.name AS student_name, g.name AS group_name,
    a.owner_id, c.title, c.reading_text, c.content, c.version AS activity_version,
    s.rubric, s.feedback AS teacher_feedback, s.updated_at AS reviewed_at
    FROM attempts t JOIN users u ON u.id=t.student_id
    JOIN assignments a ON a.id=t.assignment_id JOIN groups g ON g.id=a.group_id
    JOIN activities c ON c.id=a.activity_id LEFT JOIN assessments s ON s.attempt_id=t.id
    WHERE (t.student_id=$1 OR (a.owner_id=$1 AND $2='teacher'))
      AND ($3::text IS NULL OR t.id=$3) AND ($4::text IS NULL OR g.id=$4)
    ORDER BY t.created_at, t.id LIMIT 2001`, [user.id, user.role, attemptId || null, groupId || null]);
  if (attemptId && !rows.length) fail(404, 'Intento no encontrado.');
  if (rows.length > 2000) fail(413, 'El consolidado supera 2000 intentos. Exporta un grupo más pequeño; no se entregó un archivo incompleto.');
  return rows;
}

/** Only server-loaded records reach this adapter; no client-authored cell objects. */
export async function resultsWorkbook(db, rows, { includeChat = true } = {}) {
  const book = new ExcelJS.Workbook();
  book.creator = 'LectorLab'; book.created = new Date();
  const summary = book.addWorksheet('Resumen');
  const responses = book.addWorksheet('Respuestas');
  const chat = book.addWorksheet('LectorLab');
  summary.addRow(['Intento', 'Estudiante (seudónimo)', 'Grupo', 'Actividad', 'Versión', 'Estado', 'Entrega UTC', 'Aciertos objetivos', 'Ítems objetivos', 'Rúbrica docente', 'Devolución']);
  responses.addRow(['Intento', 'Estudiante', 'Sección / pregunta', 'Respuesta', 'Evidencia de proceso']);
  chat.addRow(['Intento', 'Estudiante', 'Turno', 'Intervención', 'Pregunta del tutor']);
  for (const row of rows) {
    summary.addRow([row.id, row.student_name, row.group_name, row.title, row.activity_version, row.status,
      row.submitted_at ? new Date(row.submitted_at).toISOString() : '', row.objective_score ?? '', row.max_objective ?? '',
      row.rubric ? JSON.stringify(row.rubric) : 'Pendiente de revisión docente', row.teacher_feedback || '']);
    const labels = { initial: 'Activación', hypothesis: 'Hipótesis', posture: 'Interpretación', evidence1: 'Evidencia 1', evidence2: 'Evidencia 2', reasoning: 'Vínculo entre evidencia e interpretación', reflection: 'Revisión de hipótesis', finalThought: 'Reflexión final' };
    for (const [field, label] of Object.entries(labels)) responses.addRow([row.id, row.student_name, label, String(row.draft?.[field] || ''), 'Producción del estudiante; no dictamen automático']);
    for (const question of row.content?.questions || []) {
      const value = row.answers?.[question.id];
      const display = typeof value === 'string' ? value : value ? JSON.stringify(value) : '';
      responses.addRow([row.id, row.student_name, question.prompt, display, question.type === 'inferential' ? 'Revisión docente' : 'Primera respuesta registrada en servidor']);
    }
    const { rows: turns } = await db.query("SELECT ordinal,student_text,assistant_text FROM tutor_turns WHERE attempt_id=$1 AND state='completed' ORDER BY ordinal", [row.id]);
    if (includeChat) for (const turn of turns) chat.addRow([row.id, row.student_name, turn.ordinal, turn.student_text, turn.assistant_text]);
    else chat.addRow([row.id, row.student_name, `${turns.length} intervenciones`, 'Consolidado sin diálogos para minimizar datos', '']);
  }
  for (const sheet of book.worksheets) {
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6D3045' } };
    sheet.columns.forEach((column, index) => { column.width = index === 0 ? 38 : 26; });
    sheet.eachRow(row => row.alignment = { vertical: 'top', wrapText: true });
  }
  return Buffer.from(await book.xlsx.writeBuffer());
}

export function createReportsRouter({ db }) {
  const router = express.Router();
  async function send(req, res, options) {
    const rows = await reportRecords(db, req.user, options);
    const buffer = await resultsWorkbook(db, rows, { includeChat: !options.groupId });
    res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.set('Content-Disposition', `attachment; filename="lectorlab-${options.groupId ? 'grupo' : 'individual'}.xlsx"`);
    res.send(buffer);
  }
  router.get('/attempts/:id/export.xlsx', (req, res) => send(req, res, { attemptId: req.params.id }));
  router.get('/groups/:id/export.xlsx', (req, res) => send(req, res, { groupId: req.params.id }));
  return router;
}
