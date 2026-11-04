import { api, download } from './api.js';
import { el, field, button, status, message, heading, show, list, empty, pill, fmt, busy } from './ui.js';

const rubricNames = { inference: 'Inferencia sustentada', evidence: 'Pertinencia de la evidencia', link: 'Vínculo entre cita e interpretación', revision: 'Revisión de la hipótesis' };
const typeNames = { mcq: 'Alternativas', inferential: 'Inferencial abierta', matching: 'Relación de elementos', completion: 'Completado' };

export async function renderTeacher(view, user, { isCurrent = () => true } = {}) {
  let section = 'Inicio';
  function page(title, intro, ...content) {
    if (!isCurrent()) return;
    const nav = el('nav', { class: 'nav', 'aria-label': 'Espacio docente' },
      ...[['Inicio', dashboard, 'nav-home'], ['Grupos', groups, 'nav-groups'], ['Actividades', activities, 'nav-activities'], ['Asignaciones', assignments, 'nav-assignments'], ['Resultados', results, 'nav-results'], ['Google Sheets', sheets, 'nav-sheets']]
        .map(([name, fn, testid]) => button(name, () => run(fn), { testid, 'aria-current': section === name ? 'page' : undefined })));
    show(view, ...heading(title, 'Espacio docente'), intro && el('p', { class: 'intro' }, intro), nav, content);
  }
  async function run(fn) {
    try { await fn(); } catch (error) {
      const note = status(); message(note, error.message, true);
      page('No se pudo completar la operación', '', note, button('Volver al inicio', () => run(dashboard)));
    }
  }
  async function action(note, control, fn) {
    await busy(control, async () => { try { await fn(); } catch (error) { message(note, error.message, true); } });
  }

  async function dashboard() {
    section = 'Inicio';
    const [groupData, activityData, resultData] = await Promise.all([api('/groups'), api('/activities'), api('/results')]);
    const groupRows = list(groupData, 'groups'), activityRows = list(activityData, 'activities'), resultRows = list(resultData, 'results');
    page(`Bienvenido, ${user.name || user.username}.`, 'Un espacio para que la lectura se convierta en una interpretación propia, sostenida con evidencias.',
      el('div', { class: 'metrics' }, ...[[groupRows.length, 'grupos'], [activityRows.length, 'actividades'], [resultRows.filter(row => row.status === 'submitted').length, 'producciones por revisar']].map(([value, title]) => el('div', { class: 'metric' }, el('strong', {}, value), title))),
      el('section', { class: 'panel' }, el('h2', {}, 'Tu primer recorrido'), el('ol', {}, el('li', {}, 'Crea un grupo y accesos individuales con alias.'), el('li', {}, 'Prepara una lectura y revisa cada pregunta, su clave y su evidencia.'), el('li', {}, 'Publica la versión revisada y asígnala al grupo.'), el('li', {}, 'Revisa las interpretaciones y devuelve una orientación concreta.')), el('div', { class: 'actions' }, button('Organizar grupos', () => run(groups), { primary: true }), button('Preparar actividades', () => run(activities)))),
      el('aside', { class: 'note' }, 'Esta primera versión se prueba con datos ficticios. No utiliza detectores de IA ni emite acusaciones de fraude. La valoración de las respuestas abiertas corresponde al docente.'));
  }

  async function groups() {
    section = 'Grupos';
    const rows = list(await api('/groups'), 'groups');
    const name = field('Nombre del grupo', { required: true, maxlength: 120, testid: 'group-name', placeholder: '4.º A · Comunicación' });
    const grade = field('Grado y sección', { required: true, maxlength: 80, testid: 'group-grade', placeholder: '4.º de secundaria' });
    const note = status();
    const submit = el('button', { type: 'submit', class: 'btn primary', 'data-testid': 'create-group' }, 'Crear grupo');
    const form = el('form', { on: { submit: async event => { event.preventDefault(); await action(note, submit, async () => { await api('/groups', { method: 'POST', body: { name: name.input.value.trim(), grade: grade.input.value.trim() } }); await groups(); }); } } }, name.node, grade.node, note, el('div', { class: 'actions' }, submit));
    const groupList = rows.length ? el('ul', { class: 'list' }, rows.map(group => el('li', {}, el('h3', {}, group.name), el('p', { class: 'small' }, group.grade || ''), button('Abrir grupo', () => run(() => groupDetail(group)), { testid: `open-group-${group.id}` })))) : empty('Todavía no hay grupos. Crea el primero aquí.');
    page('Grupos y accesos', 'Cada estudiante tiene su propia cuenta. Un código compartido no sustituye su identidad.',
      el('div', { class: 'grid' }, el('section', { class: 'panel' }, el('h2', {}, 'Tus grupos'), groupList), el('section', { class: 'panel' }, el('h2', {}, 'Nuevo grupo'), form)));
  }

  async function groupDetail(group) {
    section = 'Grupos';
    const students = list(await api(`/groups/${group.id}/students`), 'students');
    const username = field('Usuario del estudiante', { required: true, maxlength: 40, autocomplete: 'off', testid: 'student-username', placeholder: 'lector01' });
    const name = field('Alias para mostrar', { required: true, maxlength: 80, autocomplete: 'off', testid: 'student-name', placeholder: 'Explorador 01' });
    const password = field('Contraseña individual', { required: true, type: 'password', minlength: 10, maxlength: 128, autocomplete: 'new-password', testid: 'student-password' });
    const note = status();
    const submit = el('button', { type: 'submit', class: 'btn primary', 'data-testid': 'create-student' }, 'Crear acceso del estudiante');
    const reveal = button('Mostrar contraseña', event => { const visible = password.input.type === 'password'; password.input.type = visible ? 'text' : 'password'; event.currentTarget.textContent = visible ? 'Ocultar contraseña' : 'Mostrar contraseña'; }, { class: 'btn small' });
    const form = el('form', { on: { submit: async event => { event.preventDefault(); await action(note, submit, async () => { await api(`/groups/${group.id}/students`, { method: 'POST', body: { username: username.input.value.trim(), name: name.input.value.trim(), password: password.input.value } }); password.input.value = ''; await groupDetail(group); }); } } }, username.node, name.node, password.node, el('div', { class: 'actions' }, reveal), el('p', { class: 'small' }, 'Comunica el acceso de forma privada. No uses DNI, correos personales ni una contraseña común para el aula. La contraseña no se recupera desde el listado.'), note, el('div', { class: 'actions' }, submit));
    const exportNote = status();
    page(group.name, group.grade,
      button('← Todos los grupos', () => run(groups)),
      el('div', { class: 'grid' }, el('section', { class: 'panel' }, el('h2', {}, 'Estudiantes'), students.length ? el('ul', { class: 'list' }, students.map(student => el('li', {}, el('strong', {}, student.name || student.username), el('div', { class: 'small' }, `Usuario: ${student.username}`)))) : empty('El grupo aún no tiene estudiantes.'), exportNote, button('Descargar Excel del grupo', event => action(exportNote, event.currentTarget, () => download(`/groups/${group.id}/export.xlsx`, 'LectorLab_grupo.xlsx')))), el('section', { class: 'panel' }, el('h2', {}, 'Nuevo acceso'), form)));
  }

  async function activities() {
    section = 'Actividades';
    const rows = list(await api('/activities'), 'activities');
    const note = status();
    const seed = button('Usar el recorrido original', event => action(note, event.currentTarget, async () => { const data = await api('/activities/seed', { method: 'POST', body: {} }); await activityEditor(data.activity || data); }), { primary: true, testid: 'seed-activity' });
    const title = field('Título de la actividad', { required: true, maxlength: 160, testid: 'activity-title' });
    const reading = field('Texto de la lectura', { tag: 'textarea', class: 'long', required: true, maxlength: 80000, testid: 'activity-reading' });
    const createNote = status();
    const create = el('button', { type: 'submit', class: 'btn primary', 'data-testid': 'create-activity' }, 'Crear borrador');
    const createForm = el('form', { on: { submit: async event => { event.preventDefault(); await action(createNote, create, async () => { const data = await api('/activities', { method: 'POST', body: { title: title.input.value.trim(), readingText: reading.input.value.normalize('NFC'), instructions: 'Lee, construye una interpretación y sostenla con evidencias.', questions: [] } }); await activityEditor(data.activity || data); }); } } }, title.node, reading.node, createNote, el('div', { class: 'actions' }, create));
    page('Biblioteca de actividades', 'La IA propone; tú revisas. Ninguna pregunta se publica automáticamente.',
      el('section', { class: 'panel' }, el('div', { class: 'row' }, el('h2', {}, 'Tus actividades'), seed), note,
        rows.length ? el('ul', { class: 'list' }, rows.map(activity => el('li', {}, el('div', { class: 'row' }, el('div', {}, el('h3', {}, activity.title), pill(activity.status), el('span', { class: 'small' }, ` · Versión ${activity.version || 1}`)), button(activity.status === 'published' ? 'Ver versión' : 'Revisar borrador', () => run(async () => { const data = await api(`/activities/${activity.id}`); await activityEditor(data.activity || data); }), { testid: `open-activity-${activity.id}` }))))) : empty('Comienza con el recorrido original o prepara tu propia lectura.')),
      el('div', { class: 'grid' }, el('section', { class: 'panel' }, el('h2', {}, 'Desde tu texto'), createForm), el('section', { class: 'panel' }, el('h2', {}, 'Desde un documento'), documentForm())));
  }

  function documentForm() {
    const file = field('Documento PDF, DOCX o TXT', { type: 'file', accept: '.pdf,.docx,.txt', required: true, testid: 'document-file' });
    const note = status();
    const submit = el('button', { type: 'submit', class: 'btn', 'data-testid': 'upload-document' }, 'Extraer y revisar texto');
    return el('form', { class: 'filebox', on: { submit: async event => { event.preventDefault(); await action(note, submit, async () => {
      const selected = file.input.files[0]; if (!selected) throw new Error('Selecciona un documento.');
      if (selected.size > 2 * 1024 * 1024) throw new Error('El archivo debe pesar como máximo 2 MB.');
      const body = new FormData(); body.append('file', selected);
      const result = await api('/documents', { method: 'POST', body });
      await documentReview(result.document || result);
    }); } } }, file.node, el('p', { class: 'small' }, 'Máximo 2 MB. Se extrae texto; un PDF escaneado necesita OCR y se informará si no hay texto extraíble. Revisa que tengas permiso para usar el contenido y que no incluya datos personales.'), note, el('div', { class: 'actions' }, submit));
  }

  async function documentReview(document) {
    if (!document.textContent && !document.text_content) { const data = await api(`/documents/${document.id}`); document = data.document || data; }
    const title = field('Título para la actividad', { required: true, maxlength: 160, value: (document.filename || 'Nueva lectura').replace(/\.[^.]+$/, ''), testid: 'document-title' });
    const text = field('Texto extraído: corrige antes de continuar', { tag: 'textarea', class: 'long', value: document.textContent || document.text_content || '', required: true, maxlength: 80000, testid: 'document-text' });
    const reviewed = el('input', { type: 'checkbox', required: true, id: 'document-reviewed', 'data-testid': 'document-reviewed' });
    const note = status(), submit = el('button', { type: 'submit', class: 'btn primary', 'data-testid': 'document-create-activity' }, 'Crear borrador con este texto');
    const form = el('form', { on: { submit: async event => { event.preventDefault(); await action(note, submit, async () => { const data = await api(`/documents/${document.id}/activity`, { method: 'POST', body: { title: title.input.value.trim(), reviewedText: text.input.value.normalize('NFC') } }); await activityEditor(data.activity || data); }); } } }, title.node, text.node, el('label', { class: 'check', for: reviewed.id }, reviewed, 'Revisé el texto, su orden de lectura y el permiso de uso.'), note, submit);
    page('Revisar la extracción', 'Los errores del documento no deben convertirse en preguntas incorrectas. Esta revisión crea un texto de actividad nuevo.', el('section', { class: 'panel' }, form));
  }

  async function activityEditor(activity) {
    section = 'Actividades';
    const locked = activity.status === 'published';
    let questions = structuredClone(activity.questions || activity.content?.questions || []);
    const title = field('Título de la actividad', { required: true, maxlength: 160, value: activity.title, disabled: locked, testid: 'edit-activity-title' });
    const reading = field('Texto específico de esta actividad', { tag: 'textarea', class: 'long', value: activity.readingText || activity.reading_text, required: true, maxlength: 80000, disabled: locked, testid: 'edit-activity-reading' });
    const instructions = field('Propósito e instrucciones', { tag: 'textarea', value: activity.instructions || '', maxlength: 4000, disabled: locked });
    const note = status(), reviewed = el('input', { type: 'checkbox', id: 'publish-reviewed', disabled: locked, 'data-testid': 'publish-reviewed' });
    for (const input of [title.input, reading.input, instructions.input]) input.addEventListener('input', () => { reviewed.checked = false; });
    const cards = el('div', { 'data-testid': 'question-review-list' });
    function renderCards() {
      cards.replaceChildren(...(questions.length ? questions.map((question, index) => {
        const evidence = question.evidence || [];
        return el('article', { class: 'review-card' }, el('div', { class: 'eyebrow' }, `Pregunta ${index + 1} · ${typeNames[question.type] || question.type}`), el('h3', {}, question.prompt),
          question.options?.length && el('ul', {}, question.options.map(option => el('li', {}, `${option.id}. ${option.text}`))),
          question.left?.length && el('p', { class: 'small' }, 'Elementos: ', question.left.map(item => item.text).join(' · '), ' ↔ ', (question.right || []).map(item => item.text).join(' · ')),
          el('dl', {}, el('dt', {}, 'Clave o criterio privado'), el('dd', {}, typeof question.correctAnswer === 'object' ? JSON.stringify(question.correctAnswer) : question.correctAnswer || question.rubric || (question.acceptedAnswers || []).join(' / ') || 'Revisión docente de la argumentación')),
          evidence.length ? evidence.map(item => el('div', {}, el('blockquote', {}, item.quote), el('p', { class: 'small' }, item.reason || 'Falta explicar el vínculo de esta evidencia.'))) : el('p', { class: 'status error' }, 'Sin evidencia: completa una cita y su justificación antes de publicar.'),
          !locked && el('div', { class: 'question-actions' }, button('Quitar pregunta', () => { questions.splice(index, 1); reviewed.checked = false; renderCards(); }, { class: 'btn small danger' })));
      }) : [empty('Este borrador aún no tiene preguntas. Añade una o solicita propuestas a la IA configurada.')]));
    }
    renderCards();
    async function save() {
      const data = await api(`/activities/${activity.id}`, { method: 'PATCH', body: { title: title.input.value.trim(), readingText: reading.input.value.normalize('NFC'), instructions: instructions.input.value.trim(), questions } });
      activity = data.activity || data;
      return activity;
    }
    const actions = el('div', { class: 'actions' });
    if (!locked) {
      actions.append(button('Guardar borrador', event => action(note, event.currentTarget, async () => { await save(); message(note, 'Borrador guardado. Todavía no es visible para estudiantes.'); }), { testid: 'save-activity' }), button('Publicar versión revisada', event => action(note, event.currentTarget, async () => {
        if (!reviewed.checked) throw new Error('Revisa las preguntas y marca la confirmación antes de publicar.');
        await save(); const data = await api(`/activities/${activity.id}/publish`, { method: 'POST', body: { reviewed: true } }); await activityEditor(data.activity || data);
      }), { primary: true, testid: 'publish-activity' }));
    } else {
      actions.append(button('Crear nueva versión para editar', event => action(note, event.currentTarget, async () => { const data = await api(`/activities/${activity.id}/clone`, { method: 'POST', body: {} }); await activityEditor(data.activity || data); }), { primary: true, testid: 'clone-activity' }));
    }
    const content = [el('section', { class: 'panel' }, el('div', { class: 'row' }, pill(activity.status), el('span', { class: 'small' }, `Versión ${activity.version || 1}`)), title.node, reading.node, instructions.node), el('section', { class: 'panel' }, el('h2', {}, 'Revisión de preguntas y evidencias'), el('p', { class: 'small' }, 'Comprueba el enunciado, la clave o rúbrica, la cita exacta y por qué sostiene la inferencia. Las claves de esta vista docente no se envían a estudiantes.'), cards)];
    if (!locked) {
      const prompt = field('Pregunta inferencial', { required: true, maxlength: 1200, tag: 'textarea', testid: 'manual-question' });
      const quote = field('Cita literal que sustenta la pregunta', { required: true, maxlength: 2000, tag: 'textarea', testid: 'manual-evidence' });
      const reason = field('Explica el vínculo entre la cita y la inferencia', { required: true, maxlength: 2000, tag: 'textarea', testid: 'manual-reason' });
      const addNote = status(), add = el('button', { type: 'submit', class: 'btn', 'data-testid': 'add-question' }, 'Añadir pregunta al borrador');
      const addForm = el('form', { on: { submit: async event => { event.preventDefault();
        const text = reading.input.value.normalize('NFC'), selected = quote.input.value.normalize('NFC').trim(), startUtf16 = text.indexOf(selected);
        if (!selected || startUtf16 < 0) return message(addNote, 'La cita debe existir literalmente en el texto de esta versión.', true);
        const start = [...text.slice(0, startUtf16)].length;
        questions.push({ id: crypto.randomUUID(), type: 'inferential', prompt: prompt.input.value.trim(), rubric: 'Sustenta una interpretación con evidencia pertinente y explica el vínculo lógico.', evidence: [{ quote: selected, start, end: start + [...selected].length, reason: reason.input.value.trim() }] });
        reviewed.checked = false; renderCards(); prompt.input.value = ''; quote.input.value = ''; reason.input.value = ''; message(addNote, 'Pregunta añadida. Guarda el borrador para conservarla.');
      } } }, prompt.node, quote.node, reason.node, addNote, add);
      const generatedReview = el('input', { type: 'checkbox', id: 'generation-reviewed', 'data-testid': 'generation-reviewed' });
      const generateNote = status();
      const generate = button('Proponer 3 preguntas con IA', event => action(generateNote, event.currentTarget, async () => {
        if (!generatedReview.checked) throw new Error('Confirma que revisaste el texto antes de generar preguntas.');
        await save(); const data = await api(`/activities/${activity.id}/generate`, { method: 'POST', body: { count: 3, types: ['inferential', 'matching', 'completion'], textReviewed: true } }); await activityEditor(data.activity || data);
      }), { testid: 'generate-questions' });
      content.push(el('div', { class: 'grid' }, el('section', { class: 'panel' }, el('h2', {}, 'Añadir una pregunta propia'), addForm), el('section', { class: 'panel' }, el('h2', {}, 'Propuestas de IA'), el('p', { class: 'small' }, 'Genera borradores de inferencia, relación y completado. Requiere proveedor configurado en el servidor; no hay generación simulada.'), el('label', { class: 'check', for: generatedReview.id }, generatedReview, 'Revisé el texto y su permiso de uso.'), generateNote, generate)));
      const advanced = field('Preguntas en JSON (edición avanzada)', { tag: 'textarea', class: 'long code', value: JSON.stringify(questions, null, 2) });
      content.push(el('details', { class: 'panel' }, el('summary', {}, 'Edición avanzada de tipos, opciones y claves'), el('p', { class: 'small' }, 'Para relación usa left/right y correctAnswer como mapa; para completado usa acceptedAnswers. Todos los tipos requieren evidencia literal y justificación. No edites una versión ya publicada.'), advanced.node, button('Aplicar JSON al borrador', () => { try { const parsed = JSON.parse(advanced.input.value); if (!Array.isArray(parsed)) throw new Error('Se requiere una lista de preguntas.'); questions = parsed; reviewed.checked = false; renderCards(); message(note, 'Cambios aplicados localmente; guarda el borrador.'); } catch (error) { message(note, error.message, true); } })));
    }
    page(locked ? 'Versión publicada' : 'Preparar y revisar actividad', locked ? 'Esta versión es inmutable. Una edición nueva conserva los intentos y resultados anteriores.' : 'Primero revisa el texto; después, cada pregunta. Publicar requiere una decisión docente explícita.',
      button('← Biblioteca', () => run(activities)), content,
      el('section', { class: 'panel' }, !locked && el('label', { class: 'check', for: reviewed.id }, reviewed, 'Revisé texto, preguntas, claves, evidencias, pertinencia y dificultad. Apruebo esta versión para asignarla.'), note, actions));
  }

  async function assignments() {
    section = 'Asignaciones';
    const [groupData, activityData, assignmentData] = await Promise.all([api('/groups'), api('/activities'), api('/assignments')]);
    const groupRows = list(groupData, 'groups'), activityRows = list(activityData, 'activities').filter(row => row.status === 'published'), rows = list(assignmentData, 'assignments');
    const group = field('Grupo', { tag: 'select', required: true, testid: 'assignment-group' });
    group.input.append(el('option', { value: '' }, 'Selecciona un grupo'), ...groupRows.map(row => el('option', { value: row.id }, row.name)));
    const activity = field('Actividad publicada', { tag: 'select', required: true, testid: 'assignment-activity' });
    activity.input.append(el('option', { value: '' }, 'Selecciona una versión'), ...activityRows.map(row => el('option', { value: row.id }, `${row.title} · v${row.version || 1}`)));
    const note = status(), submit = el('button', { type: 'submit', class: 'btn primary', 'data-testid': 'create-assignment' }, 'Asignar al grupo');
    const form = el('form', { on: { submit: async event => { event.preventDefault(); await action(note, submit, async () => { await api('/assignments', { method: 'POST', body: { groupId: group.input.value, activityId: activity.input.value } }); await assignments(); }); } } }, group.node, activity.node, note, el('div', { class: 'actions' }, submit));
    page('Asignar una versión revisada', 'Solo se pueden asignar actividades publicadas. Cambiar después un borrador no altera lo que ya recibió el grupo.',
      el('div', { class: 'grid' }, el('section', { class: 'panel' }, el('h2', {}, 'Nueva asignación'), !groupRows.length && empty('Crea un grupo primero.'), !activityRows.length && empty('Publica al menos una actividad revisada.'), form), el('section', { class: 'panel' }, el('h2', {}, 'Asignaciones actuales'), rows.length ? el('ul', { class: 'list' }, rows.map(row => el('li', {}, el('strong', {}, row.activityTitle || row.activity?.title || activityRows.find(item => item.id === row.activityId)?.title || 'Actividad'), el('div', { class: 'small' }, row.groupName || row.group?.name || groupRows.find(item => item.id === row.groupId)?.name || 'Grupo')))) : empty('Aún no has asignado actividades.'))));
  }

  async function results() {
    section = 'Resultados';
    const rows = list(await api('/results'), 'results');
    page('Leer el razonamiento de tus estudiantes', 'Los aciertos objetivos son una parte del registro. Las interpretaciones, evidencias y revisiones necesitan tu valoración.',
      el('section', { class: 'panel' }, rows.length ? el('div', { class: 'table-wrap' }, el('table', {}, el('thead', {}, el('tr', {}, ...['Estudiante', 'Actividad y grupo', 'Estado', 'Parte objetiva', 'Acción'].map(text => el('th', { scope: 'col' }, text)))), el('tbody', {}, rows.map(row => el('tr', {}, el('td', {}, row.studentName || 'Estudiante'), el('td', {}, row.activityTitle, el('div', { class: 'small' }, row.groupName)), el('td', {}, pill(row.status)), el('td', {}, row.objectiveScore == null ? 'Sin entrega' : `${row.objectiveScore}/${row.maxObjective || 0}`), el('td', {}, button('Ver y retroalimentar', () => run(() => resultDetail(row.attemptId || row.id)), { testid: `open-result-${row.attemptId || row.id}`, class: 'btn small' }))))))) : empty('Las producciones aparecerán cuando los estudiantes comiencen sus actividades.')));
  }

  async function resultDetail(id) {
    section = 'Resultados';
    const data = await api(`/attempts/${id}`), { attempt, activity, assessment } = data;
    const draft = attempt.draft || {}, note = status();
    const rubric = Object.entries(rubricNames).map(([key, label]) => {
      const control = field(label, { tag: 'select', testid: `rubric-${key}` });
      control.input.append(...[[0, '0 · Por desarrollar'], [1, '1 · En exploración'], [2, '2 · Sustentado'], [3, '3 · Profundizado']].map(([value, text]) => el('option', { value, selected: Number(assessment?.rubric?.[key] ?? 0) === value }, text)));
      return { key, ...control };
    });
    const feedback = field('Orientación para seguir aprendiendo', { tag: 'textarea', required: true, maxlength: 4000, value: assessment?.feedback || '', testid: 'review-feedback', placeholder: 'Señala una fortaleza y un paso concreto para mejorar el vínculo entre cita e interpretación.' });
    const save = el('button', { type: 'submit', class: 'btn primary', 'data-testid': 'save-review', disabled: attempt.status === 'in_progress' }, 'Guardar devolución docente');
    const reviewForm = el('form', { on: { submit: async event => { event.preventDefault(); await action(note, save, async () => { await api(`/attempts/${id}/review`, { method: 'POST', body: { rubric: Object.fromEntries(rubric.map(item => [item.key, Number(item.input.value)])), feedback: feedback.input.value.trim() } }); await resultDetail(id); }); } } }, el('div', { class: 'rubric-grid' }, rubric.map(item => item.node)), el('p', { class: 'small' }, '0: aún no hay sustento; 1: pista o idea parcial; 2: relación pertinente y explicada; 3: sustento consistente con alternativas o revisión profunda. No evalúes por extensión o velocidad.'), feedback.node, note, el('div', { class: 'actions' }, save));
    const evidencePanel = el('section', { class: 'panel' }, el('h2', {}, 'Producción y proceso'), ...[['initial', 'Idea inicial'], ['hypothesis', 'Hipótesis'], ['posture', 'Interpretación'], ['evidence1', 'Evidencia 1'], ['evidence2', 'Evidencia 2'], ['reasoning', 'Vínculo entre citas e interpretación'], ['reflection', 'Qué cambió'], ['finalThought', 'Reflexión final']].map(([key, label]) => el('div', { class: 'review-card' }, el('h3', {}, label), el('p', {}, draft[key] || 'Sin registro'))),
      el('h3', {}, 'Respuestas a las preguntas'), ...(activity.questions || []).map(question => el('div', { class: 'review-card' }, el('strong', {}, question.prompt), el('p', {}, typeof attempt.answers?.[question.id] === 'object' ? JSON.stringify(attempt.answers[question.id]) : attempt.answers?.[question.id] || 'Sin respuesta'))),
      el('h3', {}, 'Diálogo socrático'), ...(data.tutor?.messages?.length ? data.tutor.messages.map(item => el('div', { class: `chat-message ${item.role}` }, el('strong', {}, item.role === 'user' ? 'Estudiante' : 'LectorLab'), item.content)) : [empty('No se registró diálogo con IA.')]),
      el('details', {}, el('summary', {}, 'Consultar lectura de esta versión'), el('div', { class: 'preview-text' }, activity.readingText)));
    page(activity.title, `Estado: ${attempt.status === 'in_progress' ? 'En curso' : attempt.status === 'reviewed' ? 'Revisado' : 'Entregado'} · Entrega: ${fmt(attempt.submittedAt)}`,
      el('div', { class: 'actions' }, button('← Resultados', () => run(results)), button('Descargar Excel individual', event => action(note, event.currentTarget, () => download(`/attempts/${id}/export.xlsx`, 'LectorLab_individual.xlsx')))),
      el('div', { class: 'grid' }, evidencePanel, el('section', { class: 'panel' }, el('h2', {}, 'Devolución docente'), attempt.status === 'in_progress' && el('p', { class: 'note' }, 'La actividad sigue en curso. Espera la entrega para valorar.'), reviewForm, el('p', { class: 'small' }, 'Una respuesta que necesita aclaración invita a conversar. Esta plataforma no decide fraude ni aplica sanciones automáticas.'))));
  }

  async function sheets() {
    section = 'Google Sheets';
    let connection;
    try { connection = await api('/integrations/sheets'); } catch (error) { connection = { configured: false, error: error.message }; }
    const sheet = field('ID de la hoja autorizada', { required: true, value: connection.spreadsheetId || '', maxlength: 160, testid: 'sheets-id', placeholder: 'ID del archivo, sin URL' });
    const note = status(), connect = el('button', { type: 'submit', class: 'btn primary', disabled: !connection.configured }, 'Guardar destino autorizado');
    const form = el('form', { on: { submit: async event => { event.preventDefault(); await action(note, connect, async () => { await api('/integrations/sheets', { method: 'PUT', body: { spreadsheetId: sheet.input.value.trim() } }); await sheets(); }); } } }, sheet.node, note, el('div', { class: 'actions' }, connect, button('Sincronizar pendientes', event => action(note, event.currentTarget, async () => { const data = await api('/integrations/sheets/sync', { method: 'POST', body: {} }); message(note, data.message || 'Sincronización procesada. Los errores de Google no afectan las entregas guardadas.'); }), { disabled: !connection.configured || !connection.spreadsheetId, testid: 'sheets-sync' })));
    page('Resultados en Google Sheets', 'Destino opcional. El registro principal sigue en LectorLab; las entregas no dependen de Google.', el('section', { class: 'panel' }, el('h2', {}, connection.configured ? 'Conexión disponible en el servidor' : 'Google aún no está configurado'), !connection.configured && el('p', { class: 'note' }, 'No se ha configurado la credencial del servidor. Puedes usar Excel mientras tanto; no se finge una conexión.'), el('p', { class: 'small' }, 'Comparte únicamente la hoja autorizada con la cuenta de servicio configurada. Se exportan alias, actividad y resultados necesarios; no el diálogo completo. Revocar el permiso en Google detiene el acceso sin borrar entregas.'), connection.pendingCount != null && el('p', {}, `Registros pendientes: ${connection.pendingCount}`), connection.error && el('p', { class: 'status error' }, connection.error), form));
  }

  await run(dashboard);
}
