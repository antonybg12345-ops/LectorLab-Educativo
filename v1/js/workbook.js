const ExcelJS = globalThis.ExcelJS;
import { CORRECT_ANSWERS } from "./assessment.js";

/** Build the three-sheet report from validated raw inputs and a recomputed result.
 * Browser responses/chat in local Stage A are not proof of authorship.
 */
export async function buildWorkbook({ submission, result, generatedAt = new Date() }) {
  const data = { ...submission, ...result };
  const sections = { q1: "Comprender", q2: "Comprender", q3: "Inferir", q4: "Inferir", q5: "Evaluar y revisar", q6: "Evaluar y revisar" };
  const objective = Object.entries(CORRECT_ANSWERS).map(([id, key]) => ({
    section: sections[id],
    response: submission.answers[id]?.toUpperCase() || "Sin respuesta",
    correct: submission.answers[id] === key,
  }));
  const chat = submission.chat;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "LectorLab";
  workbook.company = "RED Más allá de las palabras";
  workbook.created = generatedAt;
  workbook.modified = generatedAt;

  const palette = {
    wine: "6D3045",
    gold: "C8974C",
    blue: "446D87",
    sage: "4F786B",
    ink: "1F2530",
    light: "F8F4EC",
    soft: "F4ECE5",
    white: "FFFFFF",
    green: "2F7654",
    red: "9B4141",
    line: "DED7CF",
  };

  function title(sheet, text, subtitle) {
    sheet.mergeCells("A1:D1");
    const c = sheet.getCell("A1");
    c.value = text;
    c.font = { name: "Calibri", size: 18, bold: true, color: { argb: palette.white } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: palette.wine } };
    c.alignment = { vertical: "middle", horizontal: "left" };
    sheet.getRow(1).height = 31;

    if (subtitle) {
      sheet.mergeCells("A2:D2");
      const s = sheet.getCell("A2");
      s.value = subtitle;
      s.font = { italic: true, color: { argb: "6B7280" } };
      s.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FBF7F1" } };
      s.alignment = { wrapText: true, vertical: "middle" };
      sheet.getRow(2).height = 28;
    }
  }

  function header(row) {
    row.font = { bold: true, color: { argb: palette.white } };
    row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: palette.blue } };
    row.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    row.height = 24;
  }

  function borderRows(sheet, fromRow, toRow, cols = 4) {
    for (let r = fromRow; r <= toRow; r++) {
      for (let c = 1; c <= cols; c++) {
        const cell = sheet.getCell(r, c);
        cell.border = {
          top: { style: "thin", color: { argb: palette.line } },
          left: { style: "thin", color: { argb: palette.line } },
          bottom: { style: "thin", color: { argb: palette.line } },
          right: { style: "thin", color: { argb: palette.line } },
        };
        cell.alignment = { vertical: "top", wrapText: true };
      }
    }
  }

  // Hoja 1: resumen
  const summary = workbook.addWorksheet("Resumen", { views: [{ state: "frozen", ySplit: 3 }] });
  summary.columns = [
    { key: "campo", width: 29 },
    { key: "valor", width: 48 },
    { key: "campo2", width: 24 },
    { key: "valor2", width: 30 },
  ];
  title(summary, "Más allá de las palabras", "Demostración local: datos del navegador no verificados; no es una calificación");
  summary.addRow([]);
  summary.addRow(["Dato", "Resultado", "Dato", "Resultado"]); header(summary.getRow(4));
  summary.addRow(["Texto base", "El almohadón de pluma — versión pedagógica adaptada", "Duración objetivo", "20 minutos"]);
  summary.addRow(["Puntaje orientativo", `${Number(data.score || 0)}/${Number(data.maxScore || 9)}`, "Nivel", data.levelFormal || "—"]);
  summary.addRow(["Mérito lector", data.levelTitle || "—", "Aciertos objetivos", `${Number(data.objectiveScore || 0)}/6`]);
  summary.addRow(["Inicio informado (navegador)", data.startedAt || "—", "Cierre informado (navegador)", data.completedAt || "—"]);
  summary.addRow(["Intervenciones con LectorLab", chat.length, "Uso", "Formativo, no calificación definitiva"]);
  borderRows(summary, 4, 9, 4);
  summary.getRow(6).font = { bold: true, color: { argb: palette.wine } };
  summary.autoFilter = "A4:D9";
  summary.addRow(["Generado en este navegador (UTC)", generatedAt.toISOString(), "Verificación", "Contenido y autoría no verificados"]);

  // Hoja 2: respuestas
  const answers = workbook.addWorksheet("Respuestas", { views: [{ state: "frozen", ySplit: 4 }] });
  answers.columns = [
    { header: "Sección", key: "section", width: 23 },
    { header: "Ítem", key: "item", width: 34 },
    { header: "Respuesta del estudiante", key: "answer", width: 68 },
    { header: "Resultado", key: "result", width: 20 },
  ];
  title(answers, "Respuestas del estudiante", "Primer intento informado por el navegador, sin verificación de identidad ni persistencia.");
  answers.getRow(3).values = ["Sección", "Ítem", "Respuesta del estudiante", "Resultado"]; header(answers.getRow(3));

  const rows = [];
  rows.push(["Activación", "Respuesta inicial", data.initial || "—", "Respuesta abierta"]);
  objective.forEach((q, i) => {
    rows.push([q.section || "Preguntas", `Pregunta ${i + 1}`, q.response || "Sin respuesta", q.correct ? "Acierto" : "Por revisar"]);
  });
  rows.push(["Inferencia", "Hipótesis inicial", data.hypothesis || "—", "Respuesta abierta"]);
  rows.push(["Evaluación final", "Interpretación", data.posture || "—", data.criteria?.postureOK ? "Extensión mínima; revisar" : "Por desarrollar"]);
  rows.push(["Evaluación final", "Evidencia 1", data.evidence1 || "—", "Evidencia propuesta; revisar"]);
  rows.push(["Evaluación final", "Evidencia 2", data.evidence2 || "—", "Evidencia propuesta; revisar"]);
  rows.push(["Evaluación final", "Reflexión sobre el cambio", data.reflection || "—", data.criteria?.reflectionOK ? "Extensión mínima; revisar" : "Por desarrollar"]);
  rows.push(["Cierre", "Reflexión final", data.finalThought || "—", "Metacognición"]);
  rows.forEach(r => answers.addRow(r));
  borderRows(answers, 3, 3 + rows.length, 4);
  for (let r = 4; r <= 3 + rows.length; r++) {
    const result = String(answers.getCell(r, 4).value || "");
    if (result === "Acierto" || result === "Extensión mínima; revisar") {
      answers.getCell(r, 4).font = { color: { argb: palette.green }, bold: true };
    } else if (result === "Por revisar" || result === "Por desarrollar") {
      answers.getCell(r, 4).font = { color: { argb: palette.red }, bold: true };
    }
  }
  answers.autoFilter = `A3:D${3 + rows.length}`;

  // Hoja 3: diálogo con IA
  const chatSheet = workbook.addWorksheet("LectorLab", { views: [{ state: "frozen", ySplit: 4 }] });
  chatSheet.columns = [
    { header: "Turno", key: "turn", width: 10 },
    { header: "Estudiante", key: "student", width: 62 },
    { header: "LectorLab", key: "bot", width: 72 },
    { header: "Propósito", key: "purpose", width: 26 },
  ];
  title(chatSheet, "Guía de lectura LectorLab", "Publicación estática sin conversación de IA. Las preguntas socráticas son una guía fija.");
  chatSheet.getRow(3).values = ["Turno", "Estudiante", "LectorLab", "Propósito"]; header(chatSheet.getRow(3));
  chat.forEach((t, i) => {
    chatSheet.addRow([
      i + 1,
      t.student || "—",
      t.lectorlab || "—",
      i === chat.length - 1 && chat.length >= 5 ? "Cierre metacognitivo" : "Profundización socrática",
    ]);
  });
  if (!chat.length) chatSheet.addRow(["—", "Sin conversación de IA: guía fija de lectura", "—", "—"]);
  borderRows(chatSheet, 3, Math.max(4, 3 + chat.length), 4);

  [summary, answers, chatSheet].forEach((sheet) => {
    sheet.properties.defaultRowHeight = 19;
    sheet.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
    sheet.headerFooter.oddFooter = "LectorLab · RED Más allá de las palabras";
  });

  return await workbook.xlsx.writeBuffer();
}
