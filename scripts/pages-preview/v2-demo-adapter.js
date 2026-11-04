/*
 * Adaptador EXCLUSIVO para la presentación HTML sin instalación.
 * Simula los contratos de las vistas de LectorLab 2.0 con datos ficticios en RAM.
 * No es una API segura, una sesión, una base de datos ni un registro académico.
 * Todo el contenido de este documento es inspeccionable por quien lo abra.
 */
let demoRole = 'teacher';
let demoSequence = 0;
let demoState;
const demoStudentId = 'demo-student';
const demoCopy = value => structuredClone(value);
const demoNow = () => new Date().toISOString();
const demoId = prefix => `${prefix}-${++demoSequence}`;
const demoFail = (message, status = 400) => {
  const error = new Error(message); error.status = status; throw error;
};
const demoTeacherOnly = () => {
  if (demoRole !== 'teacher') demoFail('Cambia a la vista docente de demostración para esta acción.', 403);
};

function demoReset() {
  demoSequence = 100;
  const published = { ...demoCopy(DEMO_SEED), id: 'demo-published', status: 'published', version: 1, createdAt: demoNow() };
  const draft = { ...demoCopy(DEMO_SEED), id: 'demo-draft', title: `${DEMO_SEED.title} · Borrador`, status: 'draft', version: 2, createdAt: demoNow() };
  const quote1 = DEMO_SEED.questions?.[0]?.evidence?.[0]?.quote || '';
  const quote2 = DEMO_SEED.questions?.find(q => q.evidence?.[0]?.quote !== quote1)?.evidence?.[0]?.quote || quote1;
  const sampleDraft = {
    initial: 'Al principio acepté la explicación más comentada sin pedir evidencias.',
    hypothesis: 'Mi primera hipótesis debía contrastarse con los detalles de la lectura.',
    posture: 'Una explicación necesita conectar observaciones y considerar otras causas posibles.',
    evidence1: quote1,
    evidence2: quote2,
    reasoning: 'Estas dos citas permiten comparar una primera impresión con información adicional. Todavía debo explicar con más precisión qué relación hay entre los indicios y mi conclusión.',
    reflection: 'Pasé de una primera impresión a distinguir las observaciones de las explicaciones posibles.',
    finalThought: 'Antes de aceptar una explicación, debo volver al texto y buscar qué la sostiene y qué la limita.',
  };
  const sampleAnswers = Object.fromEntries((DEMO_SEED.questions || []).map(question => [question.id,
    question.type === 'inferential' ? 'Es necesario contrastar la explicación inicial con otra observación del texto y justificar el vínculo.' :
      question.type === 'completion' ? question.acceptedAnswers?.[0] || '' : demoCopy(question.correctAnswer ?? '')]));
  demoState = {
    groups: [{ id: 'demo-group', name: '4.º A · Grupo de demostración', grade: '4.º de secundaria' }],
    students: [{ id: demoStudentId, username: 'lector.demo', name: 'Explorador 01', role: 'student', groupIds: ['demo-group'] }],
    activities: [published, draft],
    assignments: [{ id: 'demo-assignment', groupId: 'demo-group', activityId: published.id }],
    attempts: [{ id: 'demo-example', assignmentId: 'demo-assignment', studentId: 'demo-example-student', studentName: 'Producción de ejemplo · datos ficticios', activityId: published.id, status: 'submitted', draft: sampleDraft, answers: sampleAnswers, revision: 1, startedAt: demoNow(), submittedAt: demoNow() }],
    assessments: {},
  };
  demoScore(demoState.attempts[0]);
}

function demoPrepareTour() {
  if (!demoState) demoReset();
  const assignment = demoFind(demoState.assignments, 'demo-assignment', 'Asignación de ejemplo');
  const activity = demoFind(demoState.activities, assignment.activityId, 'Actividad de ejemplo');
  const student = demoFind(demoState.students, demoStudentId, 'Estudiante ficticio');
  const evidences = (DEMO_SEED.questions || []).flatMap(question => question.evidence || []);
  const evidence1 = evidences.find(item => item.quote.startsWith('Al retirarlo,'))?.quote || evidences[0]?.quote;
  const evidence2 = (DEMO_SEED.questions || []).find(question => question.type === 'inferential')?.evidence?.find(item => item.quote !== evidence1)?.quote
    || evidences.find(item => item.quote !== evidence1)?.quote;
  if (!evidence1 || !evidence2 || !activity.readingText.includes(evidence1) || !activity.readingText.includes(evidence2)) demoFail('El recorrido preparado necesita dos citas distintas del texto de ejemplo.');
  const interpretation = 'La corrección de María es más razonable porque relaciona una mejora observada con una causa parcial y reconoce los límites de la evidencia. No presenta una sospecha sobre la familia como si fuera un hecho demostrado.';
  const reasoning = `La primera cita, «${evidence1}», muestra que limpiar la obstrucción mejoró el paso del agua, pero que el problema no desapareció por completo. La segunda, «${evidence2}», distingue ese efecto observado de una intención que nadie comprobó. Por eso el tapón es una causa parcial sustentada; acusar a la familia o atribuir todo a la menor lluvia excedería lo que permiten concluir estos indicios.`;
  const answers = Object.fromEntries(activity.questions.map(question => [question.id,
    question.type === 'inferential' ? `${interpretation} ${reasoning}` :
      question.type === 'completion' ? question.acceptedAnswers[0] : demoCopy(question.correctAnswer)]));
  const attempt = {
    id: 'demo-tour', assignmentId: assignment.id, studentId: demoStudentId,
    studentName: student.name, activityId: activity.id, status: 'in_progress',
    draft: {
      initial: 'En este ejemplo ficticio, al leer el primer mensaje pensé que la familia había desviado el agua. Había aceptado la acusación sin observar un desvío.',
      hypothesis: 'Mi hipótesis inicial atribuía el menor caudal a una acción de la familia. Debía contrastarla con las observaciones del recorrido y los registros de lluvia.',
      posture: interpretation,
      evidence1,
      evidence2,
      reasoning,
      reflection: 'Cambié mi idea cuando observé que retirar el tapón mejoró el paso del agua y que nadie había visto un desvío. Ahora distingo una causa parcial observada de una intención no demostrada, y considero la menor lluvia como una explicación adicional todavía por contrastar.',
      finalThought: 'Una explicación razonable debe conectar citas pertinentes con una conclusión, reconocer qué sigue siendo incierto y corregirse cuando aparece evidencia nueva. Una acusación compartida muchas veces no se convierte por eso en una prueba.',
    },
    answers, revision: 1, startedAt: demoNow(),
  };
  const replaced = demoState.attempts.filter(item => item.assignmentId === assignment.id && item.studentId === demoStudentId);
  for (const previous of replaced) delete demoState.assessments[previous.id];
  delete demoState.assessments[attempt.id];
  demoState.attempts = demoState.attempts.filter(item => !(item.assignmentId === assignment.id && item.studentId === demoStudentId));
  demoState.attempts.push(attempt);
  return attempt.id;
}

function demoSetRole(role) {
  if (!['teacher', 'student'].includes(role)) demoFail('Vista de demostración desconocida.');
  demoRole = role;
}

function demoFind(rows, id, label) {
  return rows.find(row => row.id === id) || demoFail(`${label} no disponible en esta demostración.`, 404);
}

function demoAssignmentRow(assignment) {
  const activity = demoFind(demoState.activities, assignment.activityId, 'Actividad');
  const group = demoFind(demoState.groups, assignment.groupId, 'Grupo');
  const attempt = demoState.attempts.find(item => item.assignmentId === assignment.id && item.studentId === demoStudentId);
  return { ...assignment, activityTitle: activity.title, groupName: group.name, ...(demoRole === 'student' && attempt ? { attemptId: attempt.id, status: attempt.status } : {}) };
}

function demoPublicActivity(activity) {
  const result = demoCopy(activity);
  result.questions = result.questions.map(({ id, type, prompt, options, left, right }) => ({ id, type, prompt, ...(options ? { options } : {}), ...(left ? { left, right } : {}) }));
  if (typeof designPreview !== 'undefined') result.evaluationRubric = designPreview.getRubric(activity.id);
  return result;
}

function demoNormalize(value) {
  return String(value).normalize('NFD').replace(/\p{M}/gu, '').trim().toLocaleLowerCase('es');
}

function demoIsCorrect(question, value) {
  if (question.type === 'mcq') return value === question.correctAnswer;
  if (question.type === 'completion') return (question.acceptedAnswers || []).some(answer => demoNormalize(answer) === demoNormalize(value));
  if (question.type === 'matching') return value && typeof value === 'object' && Object.entries(question.correctAnswer || {}).every(([key, answer]) => value[key] === answer);
  return false;
}

function demoScore(attempt) {
  const activity = demoFind(demoState.activities, attempt.activityId, 'Actividad');
  const objective = activity.questions.filter(question => question.type !== 'inferential');
  attempt.maxObjective = objective.length;
  attempt.objectiveScore = objective.filter(question => demoIsCorrect(question, attempt.answers[question.id])).length;
  const alternatives = activity.questions.filter(question => question.type === 'mcq');
  const correct = alternatives.filter(question => demoIsCorrect(question, attempt.answers[question.id])).length;
  attempt.alternatives = { correct, total: alternatives.length, percentage: alternatives.length ? Math.round(correct / alternatives.length * 1000) / 10 : null };
}

function demoAttemptData(id) {
  const attempt = demoFind(demoState.attempts, id, 'Recorrido');
  if (demoRole === 'student' && attempt.studentId !== demoStudentId) demoFail('Elige tu propio recorrido de demostración.', 403);
  const activity = demoFind(demoState.activities, attempt.activityId, 'Actividad');
  const feedback = {};
  for (const question of activity.questions) {
    if (!(question.id in attempt.answers) || question.type === 'inferential') continue;
    const correct = demoIsCorrect(question, attempt.answers[question.id]);
    feedback[question.id] = { correct, text: 'Selección registrada en esta pestaña. Vuelve al texto para explicar tu razonamiento; el registro de esta demo no es una calificación académica.' };
  }
  const visibleAttempt = demoCopy(attempt);
  if (attempt.status === 'in_progress') visibleAttempt.alternatives = null;
  if (attempt.status === 'in_progress' && demoRole === 'student') delete visibleAttempt.objectiveScore;
  return {
    attempt: visibleAttempt,
    activity: demoRole === 'teacher' ? demoCopy(activity) : demoPublicActivity(activity),
    assessment: demoCopy(demoState.assessments[id] || null),
    tutor: { available: false, configured: false, maxTurns: 5, completedCount: 0, messages: [], unresolved: [] },
    feedback,
  };
}

function demoCheckPublication(activity) {
  if (!activity.questions.length) demoFail('Añade al menos una pregunta antes de publicar la demostración.');
  if (!activity.title?.trim() || !activity.readingText?.trim()) demoFail('Completa título y lectura.');
  const characters = [...activity.readingText];
  const ids = new Set();
  for (const question of activity.questions) {
    if (!question.id || ids.has(question.id) || !question.prompt?.trim()) demoFail('Cada pregunta necesita un ID único y un enunciado.');
    ids.add(question.id);
    if (!['mcq', 'matching', 'completion', 'inferential'].includes(question.type)) demoFail('Tipo de pregunta no disponible en la demo.');
    if (!question.evidence?.length) demoFail('Cada pregunta necesita evidencia literal y justificación.');
    for (const evidence of question.evidence) {
      if (!evidence.quote || !evidence.reason?.trim() || characters.slice(evidence.start, evidence.end).join('') !== evidence.quote) demoFail('Una evidencia no coincide con la lectura o no explica su vínculo. Revisa la cita antes de publicar.');
    }
    if (question.type === 'mcq' && !question.options?.some(option => option.id === question.correctAnswer)) demoFail('Revisa las opciones y la clave de la pregunta de alternativas.');
    if (question.type === 'completion' && !question.acceptedAnswers?.length) demoFail('El completado necesita al menos una respuesta aceptada.');
    if (question.type === 'matching' && !(question.left?.length && question.right?.length && question.correctAnswer)) demoFail('La relación necesita elementos y una clave.');
  }
}

async function api(path, { method = 'GET', body } = {}) {
  if (!demoState) demoReset();
  const input = body && !(body instanceof FormData) ? demoCopy(body) : body;
  let match;
  if (path.startsWith('/documents')) demoFail('La extracción de PDF, DOCX y TXT está disponible en la plataforma con servidor, no en esta demo HTML. No se ha leído ni enviado tu archivo.');
  if (path.includes('/generate')) demoFail('La generación con IA requiere el servidor y un proveedor configurado. Esta demo no genera preguntas ni simula respuestas de IA.');
  if (path.includes('/tutor')) demoFail('Esta demo no está conectada a IA. Usa la guía socrática fija de la actividad.');
  if (path === '/integrations/sheets' && method === 'GET') {
    demoTeacherOnly(); return { configured: false, pendingCount: 0, error: 'La sincronización externa no se ejecuta desde esta demostración sin servidor.' };
  }
  if (path.startsWith('/integrations/sheets')) demoFail('Google Sheets no está conectado a esta demo.');

  if (path === '/groups') {
    demoTeacherOnly();
    if (method === 'GET') return { groups: demoCopy(demoState.groups) };
    if (method === 'POST') {
      if (!input.name?.trim() || !input.grade?.trim()) demoFail('Completa nombre y grado del grupo.');
      const group = { id: demoId('group'), name: input.name.trim(), grade: input.grade.trim() };
      demoState.groups.push(group); return { group: demoCopy(group) };
    }
  }
  if ((match = path.match(/^\/groups\/([^/]+)\/students$/))) {
    demoTeacherOnly(); const group = demoFind(demoState.groups, match[1], 'Grupo');
    if (method === 'GET') return { students: demoCopy(demoState.students.filter(student => student.groupIds.includes(group.id))) };
    if (method === 'POST') {
      if (!input.username?.trim() || !input.name?.trim()) demoFail('Completa el usuario ficticio y el alias.');
      if (demoState.students.some(student => student.username === input.username.trim())) demoFail('Ese usuario ficticio ya existe en esta pestaña.');
      // Contraseña descartada intencionalmente: aquí no se crean credenciales.
      const student = { id: demoId('student'), username: input.username.trim(), name: input.name.trim(), role: 'student', groupIds: [group.id] };
      demoState.students.push(student); return { student: demoCopy(student) };
    }
  }

  if (path === '/activities') {
    demoTeacherOnly();
    if (method === 'GET') return { activities: demoCopy(demoState.activities) };
    if (method === 'POST') {
      if (!input.title?.trim() || !input.readingText?.trim()) demoFail('Completa título y lectura.');
      const activity = { id: demoId('activity'), title: input.title.trim(), readingText: input.readingText.normalize('NFC'), instructions: input.instructions || '', questions: input.questions || [], status: 'draft', version: 1, source: { author: 'Texto añadido a la demostración' } };
      demoState.activities.push(activity); return { activity: demoCopy(activity) };
    }
  }
  if (path === '/activities/seed' && method === 'POST') {
    demoTeacherOnly(); const activity = { ...demoCopy(DEMO_SEED), id: demoId('activity'), status: 'draft', version: 1 };
    demoState.activities.push(activity); return { activity: demoCopy(activity) };
  }
  if ((match = path.match(/^\/activities\/([^/]+)(?:\/(publish|clone))?$/))) {
    demoTeacherOnly(); const activity = demoFind(demoState.activities, match[1], 'Actividad');
    if (method === 'GET' && !match[2]) return { activity: demoCopy(activity) };
    if (method === 'PATCH' && !match[2]) {
      if (activity.status !== 'draft') demoFail('La versión publicada se conserva. Crea una nueva versión para editar.');
      for (const key of ['title', 'readingText', 'instructions', 'questions']) if (input[key] !== undefined) activity[key] = demoCopy(input[key]);
      return { activity: demoCopy(activity) };
    }
    if (method === 'POST' && match[2] === 'publish') {
      if (activity.status !== 'draft') demoFail('Esta versión ya está publicada.');
      if (input.reviewed !== true) demoFail('La publicación requiere tu confirmación explícita de revisión.');
      demoCheckPublication(activity); activity.status = 'published'; return { activity: demoCopy(activity) };
    }
    if (method === 'POST' && match[2] === 'clone') {
      const cloned = { ...demoCopy(activity), id: demoId('activity'), status: 'draft', version: (activity.version || 1) + 1 };
      demoState.activities.push(cloned); return { activity: demoCopy(cloned) };
    }
  }

  if (path === '/assignments') {
    if (method === 'GET') {
      const student = demoState.students.find(item => item.id === demoStudentId);
      const assignments = demoState.assignments.filter(item => demoRole === 'teacher' || student.groupIds.includes(item.groupId));
      return { assignments: demoCopy(assignments.map(demoAssignmentRow)) };
    }
    if (method === 'POST') {
      demoTeacherOnly(); const activity = demoFind(demoState.activities, input.activityId, 'Actividad');
      demoFind(demoState.groups, input.groupId, 'Grupo');
      if (activity.status !== 'published') demoFail('Publica una versión revisada antes de asignarla.');
      if (demoState.assignments.some(item => item.activityId === activity.id && item.groupId === input.groupId)) demoFail('Esta versión ya está asignada al grupo de demostración.');
      const assignment = { id: demoId('assignment'), activityId: activity.id, groupId: input.groupId };
      demoState.assignments.push(assignment); return { assignment: demoAssignmentRow(assignment) };
    }
  }
  if ((match = path.match(/^\/assignments\/([^/]+)\/attempt$/)) && method === 'POST') {
    if (demoRole !== 'student') demoFail('Cambia a la vista estudiante para comenzar una lectura.', 403);
    const assignment = demoFind(demoState.assignments, match[1], 'Asignación');
    const student = demoState.students.find(item => item.id === demoStudentId);
    if (!student.groupIds.includes(assignment.groupId)) demoFail('Esta actividad no pertenece al grupo de la vista estudiante.', 403);
    let attempt = demoState.attempts.find(item => item.assignmentId === assignment.id && item.studentId === demoStudentId);
    if (!attempt) {
      attempt = { id: demoId('attempt'), assignmentId: assignment.id, studentId: demoStudentId, studentName: student.name, activityId: assignment.activityId, status: 'in_progress', draft: {}, answers: {}, revision: 0, startedAt: demoNow() };
      demoState.attempts.push(attempt);
    }
    return { attempt: demoCopy(attempt) };
  }

  if (path === '/results' && method === 'GET') {
    demoTeacherOnly();
    return { results: demoState.attempts.map(attempt => {
      const assignment = demoFind(demoState.assignments, attempt.assignmentId, 'Asignación');
      const row = demoAssignmentRow(assignment);
      return { id: attempt.id, attemptId: attempt.id, studentName: attempt.studentName, activityTitle: row.activityTitle, groupName: row.groupName, status: attempt.status, objectiveScore: attempt.status === 'in_progress' ? null : attempt.objectiveScore, maxObjective: attempt.maxObjective, alternatives: attempt.status === 'in_progress' ? null : demoCopy(attempt.alternatives), assessment: demoCopy(demoState.assessments[attempt.id] || null) };
    }) };
  }
  if ((match = path.match(/^\/attempts\/([^/]+)(?:\/(submit|review))?$/))) {
    const attempt = demoFind(demoState.attempts, match[1], 'Recorrido');
    if (demoRole === 'student' && attempt.studentId !== demoStudentId) demoFail('Elige tu propio recorrido de demostración.', 403);
    if (method === 'GET' && !match[2]) return demoAttemptData(attempt.id);
    if (method === 'PATCH' && !match[2]) {
      if (demoRole !== 'student') demoFail('La edición corresponde a la vista estudiante.', 403);
      if (attempt.status !== 'in_progress') demoFail('Este recorrido ya fue entregado.');
      const activity = demoFind(demoState.activities, attempt.activityId, 'Actividad');
      const updates = input.answers || {};
      for (const [questionId, value] of Object.entries(updates)) {
        const question = activity.questions.find(item => item.id === questionId) || demoFail('Pregunta desconocida.');
        if (question.type !== 'inferential' && questionId in attempt.answers && JSON.stringify(attempt.answers[questionId]) !== JSON.stringify(value)) demoFail('La primera respuesta objetiva se conserva en este recorrido de demostración.');
      }
      attempt.draft = { ...attempt.draft, ...demoCopy(input.draft || {}) };
      attempt.answers = { ...attempt.answers, ...demoCopy(updates) };
      attempt.revision++; return demoAttemptData(attempt.id);
    }
    if (method === 'POST' && match[2] === 'submit') {
      if (demoRole !== 'student') demoFail('La entrega corresponde a la vista estudiante.', 403);
      if (attempt.status !== 'in_progress') return demoAttemptData(attempt.id);
      for (const key of ['posture', 'evidence1', 'evidence2', 'reasoning', 'reflection']) if (!String(attempt.draft[key] || '').trim()) demoFail('Completa interpretación, dos evidencias, vínculo y reflexión antes de entregar.');
      const normalizeEvidence = value => String(value).normalize('NFC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('es-PE');
      if (normalizeEvidence(attempt.draft.evidence1) === normalizeEvidence(attempt.draft.evidence2)) demoFail('Propón dos evidencias distintas para la revisión docente.');
      const activity = demoFind(demoState.activities, attempt.activityId, 'Actividad');
      if (activity.questions.some(question => attempt.answers[question.id] === undefined)) demoFail('Registra todas las respuestas de la actividad antes de entregar.');
      demoScore(attempt); attempt.status = 'submitted'; attempt.submittedAt = demoNow(); return demoAttemptData(attempt.id);
    }
    if (method === 'POST' && match[2] === 'review') {
      demoTeacherOnly();
      if (attempt.status === 'in_progress') demoFail('Espera la entrega antes de valorar.');
      if (!input.feedback?.trim()) demoFail('Escribe una orientación para continuar aprendiendo.');
      if (input.criterionScores && typeof designPreview !== 'undefined') {
        const snapshot = designPreview.getRubric(attempt.activityId);
        const criteria = snapshot.criteria;
        const validIds = new Set(criteria.map(criterion => criterion.id));
        if (Object.keys(input.criterionScores).some(id => !validIds.has(id))) demoFail('La valoración debe utilizar los criterios de esta versión publicada.');
        for (const criterion of criteria) {
          const value = input.criterionScores[criterion.id];
          if (!Number.isInteger(value) || value < 0 || value > criterion.max) demoFail(`Valora «${criterion.name}» entre 0 y ${criterion.max}.`);
        }
        const total = criteria.reduce((sum, criterion) => sum + input.criterionScores[criterion.id], 0);
        const totalMax = criteria.reduce((sum, criterion) => sum + criterion.max, 0);
        const compatible = criteria.length === 4 && criteria.every(criterion => ['inference', 'evidence', 'link', 'revision'].includes(criterion.id) && criterion.max === 3);
        demoState.assessments[attempt.id] = { criteria: demoCopy(criteria), criterionScores: demoCopy(input.criterionScores), total, totalMax,
          rubric: compatible ? demoCopy(input.criterionScores) : {}, feedback: input.feedback.trim(), badges: [], reviewedAt: demoNow() };
        attempt.status = 'reviewed'; return demoAttemptData(attempt.id);
      }
      for (const key of ['inference', 'evidence', 'link', 'revision']) if (!Number.isInteger(input.rubric?.[key]) || input.rubric[key] < 0 || input.rubric[key] > 3) demoFail('Valora cada criterio entre 0 y 3.');
      const badgeNames = { inference: 'Inferencia sustentada', evidence: 'Evidencia pertinente', link: 'Vínculo explicado', revision: 'Revisión de hipótesis' };
      const badges = Object.entries(input.rubric).filter(([, value]) => value >= 2).map(([key]) => badgeNames[key]);
      demoState.assessments[attempt.id] = { rubric: demoCopy(input.rubric), feedback: input.feedback.trim(), badges, reviewedAt: demoNow() };
      attempt.status = 'reviewed'; return demoAttemptData(attempt.id);
    }
  }
  demoFail('Esta acción requiere la plataforma con servidor y no se ejecuta desde la demo HTML.', 404);
}

function demoCsvCell(value) {
  const raw = value && typeof value === 'object' ? JSON.stringify(value) : String(value ?? '');
  // Neutraliza fórmulas al abrir el CSV con aplicaciones de hojas de cálculo.
  const safe = /^[\s\uFEFF]*[=+@\-]/u.test(raw) || /^[\t\r\n]/u.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
}

async function download(path, filename = 'LectorLab_demo.csv') {
  if (!demoState) demoReset();
  const rows = [['LectorLab 2.0', 'Demostración con datos ficticios; registros solo en esta pestaña. No es un reporte académico.'], ['Estudiante', 'Actividad', 'Estado', 'Campo', 'Contenido']];
  let attempts;
  let match = path.match(/^\/attempts\/([^/]+)\/export\.xlsx$/);
  if (match) {
    demoAttemptData(match[1]); attempts = [demoFind(demoState.attempts, match[1], 'Recorrido')];
  } else if ((match = path.match(/^\/groups\/([^/]+)\/export\.xlsx$/))) {
    demoTeacherOnly(); demoFind(demoState.groups, match[1], 'Grupo');
    const assignmentIds = new Set(demoState.assignments.filter(item => item.groupId === match[1]).map(item => item.id));
    attempts = demoState.attempts.filter(item => assignmentIds.has(item.assignmentId));
  } else demoFail('La exportación solicitada no está disponible en la demostración.');
  for (const attempt of attempts) {
    const activity = demoFind(demoState.activities, attempt.activityId, 'Actividad');
    const prefix = [attempt.studentName, activity.title, attempt.status];
    for (const [key, value] of Object.entries(attempt.draft)) rows.push([...prefix, key, value]);
    for (const question of activity.questions) rows.push([...prefix, question.prompt, attempt.answers[question.id] ?? 'Sin respuesta']);
    if (attempt.status !== 'in_progress' && attempt.alternatives) {
      rows.push([...prefix, 'Alternativas: aciertos', `${attempt.alternatives.correct}/${attempt.alternatives.total}`]);
      rows.push([...prefix, 'Alternativas: porcentaje', attempt.alternatives.percentage == null ? 'Sin preguntas de alternativas' : `${attempt.alternatives.percentage} %`]);
    }
    const assessment = demoState.assessments[attempt.id];
    if (assessment) {
      rows.push([...prefix, 'Devolución docente', assessment.feedback]);
      if (assessment.criteria?.length) {
        for (const criterion of assessment.criteria) rows.push([...prefix, `Rúbrica: ${criterion.name}`, `${assessment.criterionScores[criterion.id]}/${criterion.max}`]);
        rows.push([...prefix, 'Total de rúbrica validada', `${assessment.total}/${assessment.totalMax}`]);
      } else for (const [criterion, value] of Object.entries(assessment.rubric)) rows.push([...prefix, `Rúbrica: ${criterion}`, value]);
    }
  }
  const blob = new Blob(['\uFEFF' + rows.map(row => row.map(demoCsvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = objectUrl; link.download = filename.replace(/\.xlsx$/i, '.csv');
  document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
}

demoReset();
