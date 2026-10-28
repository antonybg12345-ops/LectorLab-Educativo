import { validateSubmission } from './validation.js';
import { evaluateSubmission } from './assessment.js';
import { buildWorkbook } from './workbook.js';

export async function askTutor() {
  throw new Error('El tutor de IA necesita la aplicación con servidor. Esta publicación ofrece una guía fija sin IA.');
}

export async function exportWorkbook(input) {
  if (!globalThis.ExcelJS?.Workbook) throw new Error('No se pudo cargar el generador Excel. Recarga antes de comenzar un recorrido nuevo.');
  const submission = validateSubmission(input);
  const result = evaluateSubmission(submission);
  const bytes = await buildWorkbook({ submission, result });
  return new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
