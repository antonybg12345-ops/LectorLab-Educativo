import test from 'node:test';
import assert from 'node:assert/strict';
import { CORRECT_ANSWERS, evaluateSubmission } from '../public/js/assessment.js';

function completeSubmission() {
  return {
    answers: { ...CORRECT_ANSWERS },
    posture: 'El cuento invita a revisar la explicación inicial cuando se descubren nuevas pistas en el almohadón.',
    evidence1: 'Al despertar, Alicia se encontraba otra vez agotada.',
    evidence2: 'La sirvienta observó unas pequeñas marcas en el almohadón.',
    reflection: 'Al inicio sospeché de Jordán, pero después distinguí la atmósfera del relato de la evidencia material.',
  };
}

test('dos evidencias extensas distintas permiten calcular cierre y completitud', () => {
  const result = evaluateSubmission(completeSubmission());
  assert.equal(result.objectiveScore, 6);
  assert.equal(result.criteria.evidenceOK, true);
  assert.equal(result.score, 9);
  assert.match(result.levelDesc, /revisión docente/);
});

test('entradas vacías y breves no reciben puntos de completitud', () => {
  assert.equal(evaluateSubmission({}).score, 0);
  const result = evaluateSubmission({ posture: 'Texto breve', evidence1: 'pista', evidence2: 'otra', reflection: 'No sé' });
  assert.deepEqual(result.criteria, { postureOK: false, evidenceOK: false, reflectionOK: false });
});

test('la misma evidencia no cuenta dos veces pese a Unicode, mayúsculas y espacios', () => {
  const input = completeSubmission();
  input.evidence1 = '  Alicia amanecía débil; el almohadón tenía marcas.  ';
  input.evidence2 = 'ALICIA  AMANECÍA DÉBIL;\n EL ALMOHADÓN TENÍA MARCAS.'.normalize('NFD');
  assert.equal(evaluateSubmission(input).criteria.evidenceOK, false);
});

test('completitud no confunde emoji UTF-16 con dos caracteres de contenido', () => {
  const input = completeSubmission();
  input.evidence1 = '😀'.repeat(11);
  input.evidence2 = 'Otra evidencia extensa para comparar con la primera.';
  assert.equal(evaluateSubmission(input).criteria.evidenceOK, false);
});

test('ignora puntajes, aciertos y criterios de evaluación enviados por cliente', () => {
  const result = evaluateSubmission({
    answers: { q1: 'a', q2: 'a', q3: 'b', q4: 'a', q5: 'b', q6: 'a' },
    score: 999, maxScore: 999, objectiveScore: 6,
    correct: true, objectiveResponses: [{ correct: true }],
    criteria: { postureOK: true, evidenceOK: true, reflectionOK: true },
    levelFormal: 'Fabricado',
  });
  assert.equal(result.score, 0);
  assert.equal(result.objectiveScore, 0);
  assert.equal(result.maxScore, 9);
  assert.notEqual(result.levelFormal, 'Fabricado');
});

test('normaliza tipos inválidos sin atribuir aciertos o completitud', () => {
  const result = evaluateSubmission({ answers: null, posture: { formula: '1+1' }, evidence1: [], reflection: 500 });
  assert.equal(result.score, 0);
  assert.equal(evaluateSubmission(null).score, 0);
});

test('preguntas incorrectas reducen la parte objetiva sin alterar la completitud', () => {
  const input = completeSubmission();
  input.answers.q2 = 'a';
  input.answers.q6 = 'c';
  const result = evaluateSubmission(input);
  assert.equal(result.objectiveScore, 4);
  assert.equal(result.score, 7);
  assert.ok(Object.values(result.criteria).every(Boolean));
});
