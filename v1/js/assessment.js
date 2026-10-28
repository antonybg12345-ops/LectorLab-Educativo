/**
 * Local formative indicator shared with the Excel adapter.
 * Open answers are checked for completion only: these rules do not validate
 * textual evidence, inference quality, authorship or an academic grade.
 * The six objective keys remain public in this local Stage A version.
 */
export const CORRECT_ANSWERS = Object.freeze({
  q1: 'b', q2: 'c', q3: 'a', q4: 'c', q5: 'a', q6: 'b',
});

function normalize(value) {
  return typeof value === 'string' ? value.normalize('NFC').trim().replace(/\s+/gu, ' ') : '';
}

function length(value) {
  return [...value].length;
}

export function meritFor(score) {
  if (score <= 3) return {
    formal: 'Inicio', title: 'Explorador de pistas',
    desc: 'Este es un punto de partida para revisar tus respuestas con el docente. El indicador combina aciertos objetivos y completitud; no determina tu capacidad lectora.',
  };
  if (score <= 5) return {
    formal: 'En proceso', title: 'Lector investigador',
    desc: 'Continúa revisando tus respuestas y explicando qué sostiene cada pista. Este indicador orientativo no comprueba por sí solo la calidad del razonamiento.',
  };
  if (score <= 7) return {
    formal: 'Logro esperado', title: 'Lector analítico',
    desc: 'Tu registro reúne varios aciertos y campos desarrollados. Revisa con el docente si las evidencias realmente respaldan tu interpretación; esta banda no certifica dominio.',
  };
  return {
    formal: 'Destacado', title: 'Súper lector crítico',
    desc: 'Tu registro alcanza la banda superior de este indicador. La pertinencia de las evidencias y el vínculo con tu interpretación requieren revisión docente.',
  };
}

export function evaluateSubmission(input = {}) {
  const data = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const answers = data.answers && typeof data.answers === 'object' && !Array.isArray(data.answers) ? data.answers : {};
  const objectiveScore = Object.entries(CORRECT_ANSWERS)
    .filter(([question, correct]) => answers[question] === correct).length;
  const posture = normalize(data.posture);
  const evidence1 = normalize(data.evidence1);
  const evidence2 = normalize(data.evidence2);
  const reflection = normalize(data.reflection);
  const criteria = {
    postureOK: length(posture) >= 55,
    evidenceOK: length(evidence1) >= 22 && length(evidence2) >= 22
      && evidence1.toLocaleLowerCase('es-PE') !== evidence2.toLocaleLowerCase('es-PE'),
    reflectionOK: length(reflection) >= 50,
  };
  const score = objectiveScore + Object.values(criteria).filter(Boolean).length;
  const merit = meritFor(score);
  return {
    score, maxScore: 9, objectiveScore, criteria,
    levelFormal: merit.formal, levelTitle: merit.title, levelDesc: merit.desc,
  };
}
