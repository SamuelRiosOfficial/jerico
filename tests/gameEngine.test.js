import test from 'node:test';
import assert from 'node:assert/strict';
import {
  selectQuestionForTurn,
  resolveAnswer,
  sceneIndexForStep,
  validateQuestionBank,
  getJourneyMapPosition
} from '../src/gameEngine.js';

const sampleBank = {
  questionCount: 120,
  questions: [
    ...Array.from({ length: 40 }, (_, i) => ({ id: `F${i}`, difficulty: 'facil', question: 'F?', options: ['A','B','C','D'], correctAnswerIndex: 0, biblicalReference: 'Génesis 1:1' })),
    ...Array.from({ length: 40 }, (_, i) => ({ id: `M${i}`, difficulty: 'medio', question: 'M?', options: ['A','B','C','D'], correctAnswerIndex: 1, biblicalReference: 'Éxodo 1:1' })),
    ...Array.from({ length: 40 }, (_, i) => ({ id: `D${i}`, difficulty: 'dificil', question: 'D?', options: ['A','B','C','D'], correctAnswerIndex: 2, biblicalReference: 'Salmos 1:1' }))
  ]
};

test('valida exactamente 120 preguntas y 40 por nivel', () => {
  assert.deepEqual(validateQuestionBank(sampleBank), { facil: 40, medio: 40, dificil: 40 });
});

test('rechaza bancos incompletos o con opciones incorrectas', () => {
  assert.throws(() => validateQuestionBank({ questionCount: 2, questions: [] }));
  const malformed = structuredClone(sampleBank);
  malformed.questions[0].options = ['solo', 'tres', 'opciones'];
  assert.throws(() => validateQuestionBank(malformed), /estructura válida/);
});

test('no repite preguntas hasta agotar el grupo de dificultad', () => {
  const ids = [];
  let used = { facil: [], medio: [], dificil: [] };
  const bank = sampleBank.questions.slice(0, 3);
  for (let index = 0; index < 3; index += 1) {
    const result = selectQuestionForTurn(bank, 'facil', used, () => 0);
    assert.equal(ids.includes(result.question.id), false);
    ids.push(result.question.id);
    used = result.usedIds;
  }
  assert.equal(used.facil.length, 3);
  const next = selectQuestionForTurn(bank, 'facil', used, () => 0);
  assert.equal(next.cycleRestarted, true);
  assert.equal(next.usedIds.facil.length, 1);
});

test('mezcla opciones preservando cuál es la correcta', () => {
  const bank = sampleBank.questions.slice(40, 41);
  const result = selectQuestionForTurn(bank, 'medio', { facil: [], medio: [], dificil: [] }, () => 0.5);
  assert.equal(result.options.length, 4);
  assert.equal(result.options.filter((option) => option.correct).length, 1);
  assert.equal(result.options.find((option) => option.correct).text, 'B');
});

test('respuesta incorrecta no permite avanzar; correcta sí', () => {
  assert.deepEqual(resolveAnswer(12, false, 3), { steps: 12, won: false });
  assert.deepEqual(resolveAnswer(12, true, 2), { steps: 14, won: false });
});

test('victoria solo sucede al llegar a 30 pasos', () => {
  assert.deepEqual(resolveAnswer(28, true, 3), { steps: 30, won: true });
  assert.deepEqual(resolveAnswer(28, false, 3), { steps: 28, won: false });
});

test('cada escenario agrupa seis pasos y Jericó es el quinto', () => {
  assert.equal(sceneIndexForStep(0), 0);
  assert.equal(sceneIndexForStep(5), 0);
  assert.equal(sceneIndexForStep(6), 1);
  assert.equal(sceneIndexForStep(12), 2);
  assert.equal(sceneIndexForStep(18), 3);
  assert.equal(sceneIndexForStep(24), 4);
  assert.equal(sceneIndexForStep(30), 4);
});

test('el selector de personajes salta los que ya eligieron otros jugadores', async () => {
  const { nextAvailableCharacter } = await import('../src/gameEngine.js');
  assert.equal(nextAvailableCharacter(0, 1, [1]), 2);
  assert.equal(nextAvailableCharacter(2, -1, [1]), 0);
  assert.equal(nextAvailableCharacter(0, 1, [0, 1, 2, 3]), 0);
});


test('la posición del jugador sigue la curva SVG final de Egipto a Jericó', () => {
  const boundaries = [
    [0, { x: 18, y: 54.13 }],
    [6, { x: 25.12, y: 57.89 }],
    [12, { x: 37.69, y: 56.79 }],
    [18, { x: 52.19, y: 54.57 }],
    [24, { x: 65.88, y: 52.47 }],
    [30, { x: 73.44, y: 46.81 }]
  ];
  for (const [steps, expected] of boundaries) {
    assert.deepEqual(getJourneyMapPosition(steps), expected);
  }
  const curveMidpoint = getJourneyMapPosition(3);
  assert.deepEqual(curveMidpoint, { x: 21.63, y: 55.15 });
  assert.ok(curveMidpoint.x > boundaries[0][1].x);
  assert.ok(curveMidpoint.x < boundaries[1][1].x);
  assert.ok(curveMidpoint.y > boundaries[0][1].y);
  assert.ok(curveMidpoint.y < boundaries[1][1].y);
  // The final section must continue along the drawn trail and land on its last circle.
  assert.deepEqual(getJourneyMapPosition(27), { x: 69.78, y: 49.55 });
  assert.deepEqual(getJourneyMapPosition(-10), getJourneyMapPosition(0));
  assert.deepEqual(getJourneyMapPosition(100), getJourneyMapPosition(30));
});

test('la selección de preguntas conserva la respuesta correcta al usar traducciones',()=>{
 const q={...sampleBank.questions[0],translations:{
  pt:{question:'Quem criou este teste?',options:['A','B','C','D'],biblicalReference:'Gênesis 1:1'},
  en:{question:'Who created this test?',options:['Alpha','Beta','Gamma','Delta'],biblicalReference:'Genesis 1:1'}
 }};
 const r=selectQuestionForTurn([q],'facil',{facil:[],medio:[],dificil:[]},()=>0,'en');
 assert.equal(r.question.question,'Who created this test?');
 assert.equal(r.options.find(x=>x.correct).text,'Alpha');
});
