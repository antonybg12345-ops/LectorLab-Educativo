/*
 * Prototipo exclusivo de GitHub Pages. No llama a un modelo y no crea notas
 * académicas: permite explorar el diseño con ejemplos y datos de esta pestaña.
 * Las propuestas ilustrativas y los borradores privados se guardan separados
 * de la evaluación de ejemplo que el docente decide validar.
 */
const designPreview = (() => {
  const rubricStates = new Map();
  const privateReviews = new Map();
  const copy = value => structuredClone(value);
  const initialCriteria = () => [
    { id: 'inference', name: 'Inferencia sustentada', max: 3, descriptors: [
      'La interpretación todavía no se apoya en el texto.',
      'Plantea una idea con un apoyo parcial o poco explicado.',
      'Construye una inferencia pertinente y explica qué indicios la sostienen.',
      'Sustenta la inferencia y contrasta alternativas o reconoce sus límites.',
    ] },
    { id: 'evidence', name: 'Evidencias textuales', max: 3, descriptors: [
      'No incorpora evidencias textuales.',
      'Las pistas son poco pertinentes o difíciles de localizar.',
      'Incorpora evidencias pertinentes, parcialmente precisas.',
      'Selecciona citas pertinentes, precisas y comprobables en la lectura.',
    ] },
    { id: 'link', name: 'Vínculo entre evidencia e interpretación', max: 3, descriptors: [
      'No explica la relación entre la cita y su interpretación.',
      'Menciona una relación, pero necesita desarrollarla.',
      'Explica una relación pertinente entre los indicios y su conclusión.',
      'Explica cómo se complementan las evidencias y qué permiten concluir.',
    ] },
    { id: 'revision', name: 'Revisión de la hipótesis', max: 3, descriptors: [
      'Todavía no examina su idea inicial.',
      'Reconoce un cambio, pero no precisa qué lo hizo necesario.',
      'Relaciona el cambio de interpretación con una evidencia concreta.',
      'Revisa su hipótesis, explica la evidencia y reconoce lo que sigue incierto.',
    ] },
  ];

  function stateFor(activityId) {
    if (!rubricStates.has(activityId)) rubricStates.set(activityId, {
      criteria: initialCriteria(), source: 'example', published: false,
    });
    return rubricStates.get(activityId);
  }
  function getRubric(activityId) {
    const state = stateFor(activityId);
    return { ...copy(state), totalMax: state.criteria.reduce((sum, criterion) => sum + criterion.max, 0) };
  }
  function cloneRubric(fromId, toId) {
    const state = copy(stateFor(fromId));
    state.published = false;
    rubricStates.set(toId, state);
    return getRubric(toId);
  }
  function publishRubric(activityId) {
    stateFor(activityId).published = true;
    return getRubric(activityId);
  }

  function renderRubric({ activity, locked, onChange = () => {} }) {
    const state = stateFor(activity.id);
    if (locked) state.published = true;
    const root = el('section', { class: 'rubric-design', 'data-testid': 'demo-rubric-design' });
    const cards = el('div', { class: 'rubric-criteria' });
    const total = el('strong', { class: 'rubric-total', 'data-testid': 'demo-rubric-total' });
    const count = el('p', { class: 'small' });
    const source = el('span', { class: 'pill' });
    const note = status();
    const readOnly = () => locked || state.published;
    function refreshSummary() {
      total.textContent = `Puntaje máximo: ${getRubric(activity.id).totalMax}`;
      count.textContent = `${state.criteria.length} criterios · Puntajes por criterio y total`;
      source.textContent = state.source === 'teacher-edited' ? 'Ejemplo ajustado por docente' : 'Ejemplo de propuesta';
    }
    function changed() {
      state.source = 'teacher-edited'; refreshSummary(); onChange();
      message(note, 'Cambios de la rúbrica conservados en esta pestaña. La publicación requiere tu revisión final.');
    }
    function drawCards() {
      cards.replaceChildren(...state.criteria.map((criterion, index) => {
        const label = el('strong', {}, `${index + 1}. ${criterion.name}`);
        const maximum = el('span', { class: 'pill' }, `Máximo: ${criterion.max}`);
        const name = field('Nombre del criterio', { value: criterion.name, maxlength: 120, disabled: readOnly(), testid: `demo-rubric-name-${criterion.id}` });
        name.input.addEventListener('input', () => {
          criterion.name = name.input.value; label.textContent = `${index + 1}. ${criterion.name || 'Criterio sin nombre'}`; changed();
        });
        const max = field('Puntaje máximo', { type: 'number', min: 1, max: 10, step: 1, value: criterion.max, disabled: readOnly(), testid: `demo-rubric-max-${criterion.id}` });
        const levels = el('div', { class: 'rubric-levels' });
        function drawLevels() {
          levels.replaceChildren(...criterion.descriptors.map((descriptor, point) => {
            const control = field(`Descriptor de ${point} puntos`, { tag: 'textarea', rows: 2, maxlength: 1000, value: descriptor, disabled: readOnly(), testid: `demo-rubric-descriptor-${criterion.id}-${point}` });
            control.input.addEventListener('input', () => { criterion.descriptors[point] = control.input.value; changed(); });
            return el('div', { class: 'rubric-level' }, el('span', { class: 'pill', 'aria-hidden': 'true' }, point), control.node);
          }));
        }
        max.input.addEventListener('input', () => {
          const value = Number(max.input.value);
          if (!max.input.value || !Number.isInteger(value) || value < 1 || value > 10) {
            max.input.setCustomValidity('Elige un máximo entero de 1 a 10.');
            message(note, 'El máximo debe ser un número entero de 1 a 10. Conservamos el último valor válido.', true); return;
          }
          max.input.setCustomValidity('');
          const previous = criterion.descriptors;
          criterion.max = value;
          criterion.descriptors = Array.from({ length: value + 1 }, (_, point) => previous[point] || `Describe qué evidencia de razonamiento corresponde a ${point} puntos.`);
          maximum.textContent = `Máximo: ${criterion.max}`; drawLevels(); changed();
        });
        max.input.addEventListener('change', () => {
          if (!max.input.checkValidity()) { max.input.value = criterion.max; max.input.setCustomValidity(''); }
        });
        drawLevels();
        return el('details', { class: 'rubric-criterion', open: index === 1 },
          el('summary', { class: 'rubric-criterion-title' }, label, maximum),
          el('div', { class: 'rubric-criterion-body' }, name.node, max.node,
            el('h3', {}, 'Descriptores de logro'), levels,
            !readOnly() && button('Quitar criterio', () => {
              if (state.criteria.length <= 1) { message(note, 'Conserva al menos un criterio.', true); return; }
              if (!window.confirm(`¿Quitar «${criterion.name}» de esta rúbrica de ejemplo?`)) return;
              state.criteria = state.criteria.filter(item => item.id !== criterion.id); drawCards(); changed();
            }, { testid: `demo-rubric-remove-${criterion.id}`, class: 'btn small danger' })));
      }));
      refreshSummary();
    }
    const add = button('+ Agregar criterio', () => {
      if (state.criteria.length >= 10) { message(note, 'En esta demostración puedes explorar hasta 10 criterios.', true); return; }
      state.criteria.push({ id: `criterion-${crypto.randomUUID()}`, name: 'Nuevo criterio', max: 3, descriptors: ['Describe el nivel inicial.', 'Describe un avance parcial.', 'Describe una relación sustentada.', 'Describe un sustento profundo.'] });
      drawCards(); changed();
      cards.lastElementChild.open = true;
      cards.lastElementChild.querySelector('input')?.focus();
    }, { testid: 'demo-rubric-add', disabled: readOnly() });
    const restore = button('Restaurar ejemplo de rúbrica', () => {
      if (!window.confirm('¿Reemplazar los ajustes de esta rúbrica por el ejemplo inicial? Esta acción solo afecta a esta pestaña.')) return;
      state.criteria = initialCriteria(); state.source = 'example'; drawCards(); onChange();
      message(note, 'Ejemplo inicial restaurado. No se hizo una llamada a IA.');
    }, { testid: 'demo-rubric-restore', disabled: readOnly() });
    root.append(el('h2', {}, 'Rúbrica de la actividad'),
      el('p', {}, 'Revisa los criterios, sus descriptores y los puntajes antes de publicar.'),
      el('p', { class: 'note' }, 'Ejemplo de propuesta · Sin IA conectada. Puedes ensayar la edición docente; los cambios se conservan solo en esta pestaña.'),
      el('div', { class: 'rubric-design-grid grid' }, el('div', {}, cards, el('div', { class: 'actions' }, add)),
        el('aside', { class: 'panel rubric-summary' }, el('h3', {}, 'Resumen de la rúbrica'), count, total,
          el('p', {}, source), readOnly() && el('p', { class: 'small' }, 'Esta versión está publicada. Crea otra versión para cambiar sus criterios.'),
          el('div', { class: 'actions' }, restore),
          el('p', { class: 'small' }, 'La futura IA propondrá la rúbrica; tú podrás modificarla y aprobarla. Aquí no se generan propuestas nuevas.'))),
      note,
      el('details', { class: 'small' }, el('summary', {}, 'Lectura original y archivos: acuerdos pendientes'),
        el('p', {}, 'La lectura no debe ser reescrita por la IA. Conservar el archivo original y admitir 50 MB son requisitos acordados; esta demo no recibe archivos ni implementa su almacenamiento.')));
    drawCards(); return root;
  }

  function renderReview({ data, attempt, onValidated = () => {} }) {
    const assessment = data.assessment;
    const criteria = copy(assessment?.criteria || getRubric(data.activity.id).criteria);
    const canonical = ['inference', 'evidence', 'link', 'revision'];
    const fixed = criteria.length === 4 && canonical.every(id => criteria.some(item => item.id === id && item.max === 3));
    const example = attempt.id === 'demo-example' && fixed;
    const proposed = example ? { inference: 2, evidence: 3, link: 2, revision: 1 } : null;
    const saved = privateReviews.get(attempt.id);
    const current = saved?.criterionScores || assessment?.criterionScores || assessment?.rubric || proposed || {};
    const totalMax = criteria.reduce((sum, criterion) => sum + criterion.max, 0);
    const panel = el('section', { class: 'panel review-proposal', 'data-testid': 'demo-review-panel' });
    const total = el('strong', { class: 'review-total', 'data-testid': 'demo-review-total' });
    const reviewStatus = el('p', { class: 'pill review-status', 'data-testid': 'demo-review-status' },
      assessment ? 'Evaluación de ejemplo validada' : saved ? 'Borrador privado · Pendiente de validación' : 'Pendiente de validación');
    const note = status();
    const controls = [];
    const justifications = {
      inference: 'Ejemplo: plantea una interpretación pertinente; puede precisar qué explicaciones alternativas descarta.',
      evidence: 'Ejemplo: las dos citas se pueden comprobar en la lectura de esta actividad.',
      link: 'Ejemplo: relaciona indicios y conclusión; el vínculo aún puede desarrollarse.',
      revision: 'Ejemplo: reconoce un cambio de idea, pero necesita precisar qué pista lo hizo necesario.',
    };
    function readScores() { return Object.fromEntries(controls.map(control => [control.id, Number(control.input.value)])); }
    function refreshTotal() {
      total.textContent = `${Object.values(readScores()).reduce((sum, value) => sum + value, 0)}/${totalMax}`;
    }
    function changed() {
      reviewStatus.textContent = 'Cambios sin guardar · Pendiente de validación';
      message(note, 'Los ajustes todavía no son una evaluación validada.'); refreshTotal();
    }
    const rows = criteria.map(criterion => {
      const score = field(`Puntaje docente: ${criterion.name}`, { tag: 'select', testid: `demo-review-score-${criterion.id}`, disabled: attempt.status === 'in_progress' });
      const value = Number.isInteger(current[criterion.id]) && current[criterion.id] >= 0 && current[criterion.id] <= criterion.max ? current[criterion.id] : 0;
      score.input.append(...Array.from({ length: criterion.max + 1 }, (_, point) => el('option', { value: point, selected: value === point }, `${point}/${criterion.max}`)));
      score.input.addEventListener('change', changed);
      controls.push({ id: criterion.id, input: score.input });
      return el('tr', {},
        el('td', {}, el('strong', {}, criterion.name), example && el('p', { class: 'small' }, justifications[criterion.id])),
        el('td', {}, proposed ? `${proposed[criterion.id]}/${criterion.max}` : '—'),
        el('td', {}, score.node));
    });
    const feedback = field('Devolución docente', { tag: 'textarea', rows: 4, maxlength: 4000, value: saved?.feedback ?? assessment?.feedback ?? '', required: true, testid: 'demo-review-feedback', disabled: attempt.status === 'in_progress', placeholder: 'Explica una fortaleza y un paso concreto para mejorar el razonamiento.' });
    feedback.input.addEventListener('input', changed);
    const saveDraft = button('Guardar borrador privado', () => {
      privateReviews.set(attempt.id, { criterionScores: readScores(), feedback: feedback.input.value });
      reviewStatus.textContent = 'Borrador privado · Pendiente de validación';
      message(note, 'Borrador conservado en esta pestaña. No se publicó al estudiante ni se modificó la evaluación validada.');
    }, { testid: 'demo-save-review-draft', disabled: attempt.status === 'in_progress' });
    const validate = button('Validar evaluación de ejemplo', async event => {
      await busy(event.currentTarget, async () => {
        try {
          const criterionScores = readScores();
          const text = feedback.input.value.trim();
          if (!text) throw new Error('Escribe una devolución antes de validar la evaluación.');
          for (const criterion of criteria) if (!Number.isInteger(criterionScores[criterion.id]) || criterionScores[criterion.id] < 0 || criterionScores[criterion.id] > criterion.max) throw new Error('Comprueba los puntajes de cada criterio.');
          await api(`/attempts/${attempt.id}/review`, { method: 'POST', body: {
            criteria: copy(criteria), criterionScores, ...(fixed ? { rubric: copy(criterionScores) } : {}), feedback: text,
          } });
          privateReviews.delete(attempt.id);
          reviewStatus.textContent = 'Evaluación de ejemplo validada';
          message(note, 'Evaluación de ejemplo validada en esta pestaña.');
          await onValidated();
        } catch (error) { message(note, error.message, true); }
      });
    }, { testid: 'demo-validate-review', primary: true, disabled: attempt.status === 'in_progress' });
    const quotes = example ? ['evidence1', 'evidence2'].map(key => attempt.draft?.[key]).filter(quote => quote && data.activity.readingText.includes(quote)) : [];
    panel.append(...[el('div', { class: 'dashboard-panel-heading row' }, el('h2', {}, 'Rúbrica y validación docente'), reviewStatus),
      el('p', { class: 'note' }, example
        ? 'Propuesta ilustrativa, preparada para esta producción de ejemplo. No fue generada por IA. Tú puedes ajustar cada puntaje y validar la devolución.'
        : 'Sin propuesta de IA. Valora esta producción de demostración con los criterios de su actividad.'),
      el('div', { class: 'table-wrap rubric-review-table' }, el('table', {},
        el('thead', {}, el('tr', {}, el('th', { scope: 'col' }, 'Criterio'), el('th', { scope: 'col' }, 'Ejemplo de propuesta'), el('th', { scope: 'col' }, 'Docente'))), el('tbody', {}, rows))),
      el('div', { class: 'review-summary row' }, el('span', {}, 'Total de la rúbrica'), total),
      example && el('p', { class: 'small', 'data-testid': 'demo-proposed-total' }, 'Propuesta ilustrativa original: 8/12 · Provisional'),
      quotes.length > 0 && el('details', { class: 'small' }, el('summary', {}, 'Citas comprobables que acompañan el ejemplo'), quotes.map(quote => el('blockquote', {}, quote))),
      feedback.node, note, attempt.status === 'in_progress' && el('p', { class: 'note' }, 'Espera a que se entregue el recorrido para valorar.'),
      el('div', { class: 'actions' }, saveDraft, validate),
      el('p', { class: 'small' }, 'Guardar borrador conserva una revisión privada. El estudiante solo recibe la evaluación de ejemplo después de validarla. No se combina este total con los aciertos de alternativas.'),
      assessment?.reviewedAt && el('p', { class: 'small' }, `Validación de ejemplo: ${fmt(assessment.reviewedAt)}`)
      ].filter(child => child !== false && child !== null && child !== undefined));
    refreshTotal(); return panel;
  }

  return { renderRubric, renderReview, getRubric, cloneRubric, publishRubric };
})();
