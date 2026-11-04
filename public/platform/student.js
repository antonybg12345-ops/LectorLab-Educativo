import { api, download } from './api.js';
import { el, field, button, status, message, heading, show, list, empty, pill, fmt, busy } from './ui.js';

const phaseNames = ['Activación', 'Lectura', 'Comprender', 'Inferir', 'Evaluar', 'Tutor socrático', 'Mi interpretación'];

export async function renderStudent(view, user, { isCurrent = () => true } = {}) {
  let disposeAttempt = null;
  async function dashboard() {
    if (!isCurrent()) return;
    disposeAttempt?.(); disposeAttempt = null;
    history.replaceState(null, '', '/estudiante');
    const rows = list(await api('/assignments'), 'assignments');
    if (!isCurrent()) return;
    const entries = rows.map(assignment => {
      const details = el('div', {}, el('h3', {}, assignment.activityTitle || 'Actividad de lectura'),
        el('p', { class: 'small' }, assignment.groupName || ''), assignment.status && pill(assignment.status));
      const label = ['submitted', 'reviewed'].includes(assignment.status) ? 'Ver mi recorrido' : assignment.attemptId ? 'Continuar lectura' : 'Comenzar lectura';
      const open = button(label, async event => {
        await busy(event.currentTarget, async () => {
          try {
            const data = await api(`/assignments/${assignment.id}/attempt`, { method: 'POST', body: {} });
            await openAttempt(data.attempt.id);
          } catch (error) { window.alert(error.message); }
        });
      }, { primary: true, testid: `open-assignment-${assignment.id}` });
      return el('li', {}, el('div', { class: 'row' }, details, open));
    });
    show(view, ...heading(`Tu espacio de lectura, ${user.name || user.username}.`, 'Espacio estudiante'),
      el('p', { class: 'intro' }, 'Lee a tu ritmo, plantea una idea y vuelve al texto para sostenerla. Tus respuestas se guardan en tu cuenta.'),
      el('section', { class: 'panel' }, el('h2', {}, 'Actividades de tu grupo'), entries.length ? el('ul', { class: 'list' }, entries) : empty('Todavía no tienes actividades asignadas. Tu docente te indicará cuándo comenzar.')),
      el('aside', { class: 'note' }, 'Las interpretaciones se revisan con tu docente. No se premia escribir más rápido ni enviar más mensajes. Tu progreso es privado.'));
  }

  async function openAttempt(id) {
    if (!isCurrent()) return;
    if (!id) throw new Error('No se pudo identificar el recorrido. Vuelve a tus actividades e inténtalo otra vez.');
    disposeAttempt?.();
    let data = await api(`/attempts/${id}`);
    if (!isCurrent()) return;
    let { attempt, activity } = data;
    let draft = { ...attempt.draft }, answers = { ...attempt.answers };
    let step = Math.max(0, Math.min(6, Number(new URLSearchParams(location.search).get('paso')) || 0));
    if (attempt.status !== 'in_progress') step = 6;
    let version = 0, savedVersion = 0, activeSaves = 0, saveTimer, queue = Promise.resolve(), disposed = false, tutorPending = false, lastTutorRequest = null;
    const note = status(), saveStatus = el('p', { class: 'save-status', role: 'status', 'aria-live': 'polite', 'data-testid': 'save-status' }, 'Guardado');
    const phaseBody = el('section', { class: 'panel', id: 'phase-body' });
    const navigation = el('nav', { class: 'steps', 'aria-label': 'Etapas del recorrido' });
    const progress = el('progress', { max: 7, value: step + 1, 'aria-label': 'Progreso del recorrido', style: 'width:100%;accent-color:var(--wine)' });
    const readOnly = () => attempt.status !== 'in_progress';
    function updateSaveStatus(failed = false) {
      saveStatus.textContent = failed ? 'Cambios sin guardar. Reintenta antes de salir.' : activeSaves ? 'Guardando…' : savedVersion < version ? 'Cambios sin guardar…' : 'Guardado';
      saveStatus.style.color = failed ? 'var(--danger)' : 'var(--sage)';
    }
    const beforeUnload = event => { if (activeSaves || savedVersion < version) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', beforeUnload);
    const currentLocation = () => `/estudiante?attempt=${encodeURIComponent(id)}&paso=${step}`;
    disposeAttempt = () => { disposed = true; clearTimeout(saveTimer); window.removeEventListener('beforeunload', beforeUnload); if (window.lectorlabBeforeLeave === beforeLeave) delete window.lectorlabBeforeLeave; if (window.lectorlabDispose === disposeAttempt) delete window.lectorlabDispose; if (window.lectorlabCurrentLocation === currentLocation) delete window.lectorlabCurrentLocation; };
    async function beforeLeave() {
      if (tutorPending) { message(note, 'Espera a que termine la solicitud del tutor antes de salir de la actividad.', true); return false; }
      try { await flush(); return true; } catch { return window.confirm('Hay cambios que no pudieron guardarse. ¿Salir y descartar esos cambios de esta pestaña?'); }
    }
    window.lectorlabBeforeLeave = beforeLeave;
    window.lectorlabDispose = disposeAttempt;
    window.lectorlabCurrentLocation = currentLocation;
    function setDirty() { version++; updateSaveStatus(); clearTimeout(saveTimer); saveTimer = setTimeout(() => { flush().catch(() => {}); }, 500); }
    function applyResponse(result) {
      const updated = result.attempt || result;
      if (updated.id) { attempt = { ...attempt, ...updated }; answers = { ...answers, ...(updated.answers || {}) }; }
      if (result.feedback) data.feedback = result.feedback;
    }
    async function saveBody(body, targetVersion = version) {
      activeSaves++; updateSaveStatus();
      const job = queue.catch(() => {}).then(async () => {
        const result = await api(`/attempts/${id}`, { method: 'PATCH', body }); applyResponse(result);
        savedVersion = Math.max(savedVersion, targetVersion); return result;
      });
      queue = job;
      try { const result = await job; message(note, ''); return result; }
      catch (error) { message(note, error.message, true); throw error; }
      finally { activeSaves--; updateSaveStatus(savedVersion < version && activeSaves === 0); }
    }
    async function flush() {
      clearTimeout(saveTimer);
      if (readOnly()) return;
      if (savedVersion >= version) return queue;
      const openAnswers = Object.fromEntries((activity.questions || []).filter(question => question.type === 'inferential' && typeof answers[question.id] === 'string').map(question => [question.id, answers[question.id]]));
      return saveBody({ draft: { ...draft }, ...(Object.keys(openAnswers).length ? { answers: openAnswers } : {}) }, version);
    }
    async function answer(question, value) {
      if (readOnly() || tutorPending) return;
      try {
        await flush();
        const result = await saveBody({ answers: { [question.id]: value } });
        applyResponse(result);
        const fresh = await api(`/attempts/${id}`); data.feedback = fresh.feedback; attempt = fresh.attempt; answers = { ...attempt.answers }; renderPhase(false);
      } catch { /* Preserve unsent text and show the message above. */ }
    }
    function draftField(key, label, options = {}) {
      const control = field(label, { tag: 'textarea', maxlength: 4000, ...options, value: draft[key] || '', disabled: readOnly(), testid: key });
      control.input.addEventListener('input', () => { draft[key] = control.input.value; setDirty(); });
      return control.node;
    }
    async function move(next) {
      if (tutorPending) return;
      try { await flush(); step = Math.max(0, Math.min(6, next)); renderPhase(); } catch { /* Stay with unsaved work. */ }
    }
    const readingText = el('div', { class: 'reading-text', 'data-testid': 'reading-text' }, ...String(activity.readingText || '').split(/\n\s*\n/).filter(Boolean).map((paragraph, index) => el('p', {}, el('span', { class: 'para-num', 'aria-label': `Párrafo ${index + 1}` }, index + 1), paragraph)));
    function citeSelected(key) {
      const selection = window.getSelection();
      if (!selection?.rangeCount || !readingText.contains(selection.anchorNode) || !readingText.contains(selection.focusNode) || !selection.toString().trim()) return message(note, 'Selecciona primero un fragmento dentro de la lectura.', true);
      draft[key] = selection.toString().trim(); setDirty();
      if (step === 6) renderPhase(false);
      message(note, `Fragmento añadido como ${key === 'evidence1' ? 'evidencia 1' : 'evidencia 2'}. Explica por qué sostiene tu interpretación.`);
    }
    const readingPanel = el('aside', { class: 'reading-panel' }, el('details', { open: true }, el('summary', {}, 'Texto de esta actividad · consultar y citar'), el('h2', {}, activity.title), readingText,
      !readOnly() && el('div', { class: 'actions' }, button('Citar selección como evidencia 1', () => citeSelected('evidence1'), { class: 'btn small' }), button('Citar selección como evidencia 2', () => citeSelected('evidence2'), { class: 'btn small' }))),
      el('p', { class: 'small' }, 'La cita ayuda a volver al texto. Su pertinencia y tu explicación se revisan con el docente.'),
      el('div', { class: 'sources' }, 'Lectura de la versión asignada. ', activity.source?.author && `${activity.source.author}. `, activity.source?.title || '', activity.source?.url && el('a', { href: safeSource(activity.source.url), target: '_blank', rel: 'noopener noreferrer' }, 'Consultar fuente'),
        String(activity.title).includes('Más allá') && el('p', {}, 'Adaptación pedagógica de El almohadón de pluma, de Horacio Quiroga. Competencia: lee diversos tipos de textos escritos en lengua materna.')));
    function renderQuestion(question, index) {
      const value = answers[question.id], hasAnswer = value !== undefined && value !== null && value !== '';
      const feedback = data.feedback?.[question.id];
      const card = el('article', { class: 'question', 'data-question': question.id }, el('div', { class: 'eyebrow' }, `Pregunta ${index + 1}`), el('h3', {}, question.prompt));
      if (question.type === 'mcq') {
        for (const option of question.options || []) {
          const selected = value === option.id;
          const label = /^[a-z]\.\s/iu.test(option.text) ? option.text : `${option.id.toUpperCase()}. ${option.text}`;
          card.append(button(label, async event => { await busy(event.currentTarget, () => answer(question, option.id)); }, {
            class: `choice${selected ? ' selected' : ''}${selected && feedback?.correct === true ? ' correct' : ''}`,
            testid: `question-${question.id}-answer-option-${option.id}`, disabled: hasAnswer || readOnly() || tutorPending,
            'aria-pressed': selected ? 'true' : 'false',
          }));
        }
        if (hasAnswer) card.append(el('p', { class: 'small' }, 'Primera respuesta guardada. Puedes revisar tu razonamiento sin sustituirla.'));
      } else if (question.type === 'matching') {
        const selections = [];
        for (const left of question.left || []) {
          const select = field(left.text, { tag: 'select', disabled: hasAnswer || readOnly(), testid: `question-${question.id}-match-${left.id}` });
          select.input.append(el('option', { value: '' }, 'Selecciona una relación'), ...(question.right || []).map(right => el('option', { value: right.id, selected: value?.[left.id] === right.id }, right.text)));
          selections.push({ id: left.id, input: select.input }); card.append(select.node);
        }
        if (!hasAnswer && !readOnly()) card.append(button('Registrar relaciones', async event => { if (selections.some(item => !item.input.value)) return message(note, 'Completa todas las relaciones antes de registrarlas.', true); await busy(event.currentTarget, () => answer(question, Object.fromEntries(selections.map(item => [item.id, item.input.value])))); }, { testid: `question-${question.id}-register` }));
        card.append(el('p', { class: 'small' }, 'Las relaciones se registran juntas como primer intento. No se guardan selecciones parciales.'));
      } else if (question.type === 'completion') {
        const completion = field('Tu completado', { value: value || '', maxlength: 500, disabled: hasAnswer || readOnly(), testid: `question-${question.id}-answer` });
        card.append(completion.node);
        if (!hasAnswer && !readOnly()) card.append(button('Registrar completado', async event => { if (!completion.input.value.trim()) return message(note, 'Escribe tu completado antes de registrarlo.', true); await busy(event.currentTarget, () => answer(question, completion.input.value.trim())); }, { testid: `question-${question.id}-register` }));
      } else {
        const open = field('Tu respuesta y su sustento', { tag: 'textarea', value: value || '', maxlength: 4000, disabled: readOnly(), testid: `question-${question.id}-answer` });
        open.input.addEventListener('input', () => { answers[question.id] = open.input.value; setDirty(); });
        card.append(open.node, el('p', { class: 'small' }, 'Respuesta abierta: su calidad será revisada por tu docente.'));
      }
      if (feedback?.text) card.append(el('p', { class: 'feedback', role: 'status' }, feedback.text));
      return card;
    }
    function renderTutor() {
      const tutor = data.tutor || {}, configured = tutor.available !== false, completed = Number(tutor.completedCount || 0), max = Number(tutor.maxTurns || 5);
      const chat = el('div', { class: 'chat-log', 'aria-live': 'polite', 'data-testid': 'tutor-messages' }, ...(tutor.messages?.length ? tutor.messages.map(item => el('div', { class: `chat-message ${item.role}` }, el('strong', {}, item.role === 'user' ? 'Tú' : 'LectorLab'), item.content)) : [el('p', { class: 'small' }, 'El tutor te invitará a justificar tus ideas. No redactará tu interpretación final.')]));
      for (const item of tutor.unresolved || []) chat.append(el('div', { class: 'note' }, el('strong', {}, item.state === 'pending' ? 'Idea guardada; respuesta pendiente: ' : 'Idea conservada sin respuesta confirmada: '), item.content));
      const input = field('Tu interpretación o duda para el tutor', { tag: 'textarea', maxlength: 500, disabled: !configured || readOnly() || completed >= max || tutorPending, testid: 'tutor-input', value: lastTutorRequest?.message || '' });
      const send = el('button', { type: 'submit', class: 'btn green', disabled: !configured || readOnly() || completed >= max || tutorPending, 'data-testid': 'tutor-send' }, tutorPending ? 'Esperando al tutor…' : 'Conversar con LectorLab');
      const tutorNote = status();
      const form = el('form', { on: { submit: async event => {
        event.preventDefault(); if (tutorPending || !input.input.value.trim()) return;
        try {
          await flush(); tutorPending = true;
          const text = input.input.value.trim();
          if (!lastTutorRequest || lastTutorRequest.message !== text) lastTutorRequest = { message: text, requestId: crypto.randomUUID() };
          send.disabled = true; input.input.disabled = true; send.textContent = 'Esperando al tutor…';
          navigation.querySelectorAll('button').forEach(control => { control.disabled = true; });
          phaseBody.querySelectorAll('[data-testid="next-step"],[data-testid="previous-step"]').forEach(control => { control.disabled = true; });
          const response = await api(`/attempts/${id}/tutor`, { method: 'POST', body: lastTutorRequest });
          if (response.pending || response.state === 'pending') message(tutorNote, 'Tu intervención sigue procesándose. No la dupliques; puedes consultar el estado al volver a abrir la actividad.');
          else { lastTutorRequest = null; input.input.value = ''; }
          data = await api(`/attempts/${id}`); attempt = data.attempt; answers = { ...attempt.answers }; tutorPending = false; renderPhase(false);
        } catch (error) {
          tutorPending = false;
          if (error.status) lastTutorRequest = null;
          message(tutorNote, `${error.message} Tu idea sigue en el cuadro; un fallo técnico no consume una intervención completada.`, true);
          input.input.disabled = readOnly() || completed >= max; send.disabled = readOnly() || completed >= max; send.textContent = 'Reintentar conversación';
          navigation.querySelectorAll('button').forEach(control => { control.disabled = false; });
          phaseBody.querySelectorAll('[data-testid="next-step"],[data-testid="previous-step"]').forEach(control => { control.disabled = false; });
          input.input.focus();
        }
      } } }, input.node, tutorNote, el('div', { class: 'actions' }, send));
      return [el('p', {}, 'El tutor usa la lectura de esta actividad y tus intervenciones guardadas. Te pide pistas, vínculos y alternativas; no escribe la respuesta por ti.'), el('p', { class: 'small', 'data-testid': 'tutor-count' }, `${completed} de ${max} intervenciones completadas.`), !configured && el('p', { class: 'note' }, 'La IA no está configurada en este servidor. Puedes continuar con la guía de lectura sin IA y entregar tu trabajo.'), chat, configured && form,
        el('details', { class: 'note', open: !configured }, el('summary', {}, 'Guía de lectura sin IA'), el('ol', {}, el('li', {}, '¿Qué fragmento concreto sostiene tu interpretación?'), el('li', {}, '¿Por qué esa pista apoya tu idea y no otra explicación?'), el('li', {}, '¿Qué cambió cuando apareció una evidencia nueva?')), el('p', { class: 'small' }, 'Esta guía es una actividad fija de apoyo; no es una conversación generada por IA.'))];
    }
    function renderFinal() {
      const final = [el('p', {}, 'Formula tu interpretación, incorpora dos pistas y explica el vínculo. Puedes cambiar de idea: cuenta qué evidencia hizo necesaria la revisión.'),
        draftField('posture', '1. Mi interpretación'), draftField('evidence1', '2. Evidencia 1', { maxlength: 2000 }), draftField('evidence2', '3. Evidencia 2', { maxlength: 2000 }), draftField('reasoning', '4. ¿Por qué estas evidencias sostienen mi interpretación?'), draftField('reflection', '5. ¿Qué cambió entre mi primera idea y mi interpretación actual?'), draftField('finalThought', '6. Reflexión final: ¿qué necesita una explicación para ser razonable?')];
      if (!readOnly()) {
        final.push(el('p', { class: 'small' }, 'La entrega conserva tus primeras respuestas objetivas. Las respuestas abiertas quedan pendientes de revisión docente; escribir más no significa razonar mejor.'), button('Entregar mi interpretación', async event => {
          await busy(event.currentTarget, async () => {
            try {
              for (const key of ['posture', 'evidence1', 'evidence2', 'reasoning', 'reflection']) if (!String(draft[key] || '').trim()) throw new Error('Completa interpretación, dos evidencias, vínculo y reflexión antes de entregar.');
              await flush(); await api(`/attempts/${id}/submit`, { method: 'POST', body: {} });
              data = await api(`/attempts/${id}`); attempt = data.attempt; draft = { ...attempt.draft }; answers = { ...attempt.answers }; savedVersion = version; renderPhase();
            } catch (error) { message(note, error.message, true); }
          });
        }, { primary: true, testid: 'submit-attempt' }));
      } else {
        final.unshift(el('p', { class: 'status', 'data-testid': 'submission-status' }, `Entrega guardada el ${fmt(attempt.submittedAt)}. ${attempt.status === 'reviewed' ? 'Tu docente ya dejó una devolución.' : 'Tu interpretación está pendiente de revisión docente.'}`));
        if (attempt.objectiveScore != null) final.push(el('p', { 'data-testid': 'objective-score' }, `Preguntas objetivas: ${attempt.objectiveScore}/${attempt.maxObjective || 0}. Esta parte no califica por sí sola tu interpretación.`));
      }
      if (data.assessment) {
        final.push(el('section', { class: 'review-card' }, el('h3', {}, 'Devolución de tu docente'), el('p', { 'data-testid': 'teacher-feedback' }, data.assessment.feedback), el('div', { class: 'badges' }, (data.assessment.badges || []).map(badge => el('span', { class: 'badge' }, typeof badge === 'string' ? badge : badge.label || badge.title || badge.name))), el('p', { class: 'small' }, 'Estos hitos reconocen evidencia revisada en esta actividad. No son una etiqueta permanente ni una comparación con tus compañeros.')));
      }
      final.push(button('Descargar mi recorrido en Excel', async event => { await busy(event.currentTarget, async () => { try { await flush(); await download(`/attempts/${id}/export.xlsx`, 'LectorLab_mi_recorrido.xlsx'); } catch (error) { message(note, error.message, true); } }); }, { testid: 'download-attempt' }));
      return final;
    }
    function renderPhase(focus = true) {
      if (!isCurrent() || disposed) return;
      history.replaceState(null, '', currentLocation());
      progress.value = step + 1;
      navigation.replaceChildren(...phaseNames.map((name, index) => button(`${index + 1}. ${name}`, () => move(index), { class: 'step-dot', testid: `step-${index}`, 'aria-current': index === step ? 'step' : undefined, disabled: tutorPending })));
      const body = [el('div', { class: 'eyebrow' }, `Etapa ${step + 1} de 7`), el('h2', { tabindex: '-1' }, phaseNames[step])];
      if (step === 0) body.push(el('p', {}, 'Antes de analizar las pistas: ¿cuándo una explicación es suficiente para aceptarla?'), draftField('initial', 'Escribe tu primera idea'), el('p', { class: 'small' }, 'No buscamos una respuesta perfecta. Al final podrás revisar qué cambió.'));
      if (step === 1) body.push(el('p', {}, activity.instructions || 'Lee el texto completo y observa qué detalles despiertan sospechas y cuáles permiten sostener una conclusión.'), el('div', { class: 'note' }, 'El texto de la izquierda queda disponible durante todo el recorrido. En móvil puedes abrirlo o cerrarlo para consultarlo. Los párrafos numerados te ayudarán a citar.'), el('p', { class: 'small' }, 'Tiempo orientativo: unos 20 minutos. No se penaliza tu ritmo de lectura.'));
      if (step >= 2 && step <= 4) {
        const questions = activity.questions || [], chunk = Math.max(1, Math.ceil(questions.length / 3)), start = (step - 2) * chunk;
        const items = questions.slice(start, start + chunk);
        body.push(...(items.length ? items.map((question, index) => renderQuestion(question, start + index)) : [el('p', {}, 'Vuelve al texto: distingue lo que aparece expresamente de lo que estás infiriendo.')]));
        if (step === 3) body.push(draftField('hypothesis', 'Tu hipótesis: ¿qué habrías pensado antes del desenlace?'), el('p', { class: 'small' }, 'Si ya leíste el final, reconoce que esta hipótesis es una reconstrucción retrospectiva.'));
        if (step === 4) body.push(el('p', { class: 'note' }, 'Cambiar una interpretación ante evidencia nueva no es fallar: es revisar una conclusión con mejores razones.'));
      }
      if (step === 5) body.push(...renderTutor());
      if (step === 6) body.push(...renderFinal());
      body.push(el('div', { class: 'actions' }, step > 0 && button('← Etapa anterior', () => move(step - 1), { testid: 'previous-step', disabled: tutorPending }), step < 6 && button('Siguiente etapa →', () => move(step + 1), { primary: true, testid: 'next-step', disabled: tutorPending })));
      phaseBody.replaceChildren(...body.filter(Boolean));
      if (focus) { phaseBody.querySelector('h2')?.focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: 'instant' }); }
      updateSaveStatus();
    }
    show(view, ...heading(activity.title, 'Tu recorrido'), el('div', { class: 'row' }, pill(attempt.status), button('← Mis actividades', async () => { if (await beforeLeave()) await dashboard(); })), progress, navigation, saveStatus, note,
      el('div', { class: 'reading-layout' }, readingPanel, phaseBody));
    renderPhase(false);
    if (disposed) disposeAttempt?.();
  }
  const openId = new URLSearchParams(location.search).get('attempt');
  if (openId) await openAttempt(openId); else await dashboard();
}

function safeSource(value) {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : '#'; } catch { return '#'; }
}
