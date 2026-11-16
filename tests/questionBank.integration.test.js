import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateQuestionBank, selectQuestionForTurn } from '../src/gameEngine.js';

const loadBank = () => JSON.parse(readFileSync(
  new URL('../public/data/question-bank.multilingual.json', import.meta.url),
  'utf8'
));

const expectedBooks = {
  "Génesis":50,"Éxodo":50,"Levítico":50,"Hechos":50,
  "Mateo":50,"Marcos":50,"Lucas":50,"Juan":50,
  "Jonás":50,"Jueces":50,"Apocalipsis":50,"Daniel":50
};

test('el banco multilingüe contiene 900 preguntas y 300 por dificultad', () => {
  const bank = loadBank();
  assert.equal(bank.version, 5);
  assert.deepEqual(bank.languages, ['es', 'pt', 'en']);
  assert.equal(bank.questionCount, 900);
  assert.deepEqual(validateQuestionBank(bank), { facil:300, medio:300, dificil:300 });
  assert.deepEqual(bank.distribution, { facil:300, medio:300, dificil:300 });
  assert.equal(bank.randomizeQuestionOrder, true);
  assert.equal(bank.randomizeAnswerOrder, true);
  assert.equal(bank.noRepeatUntilDifficultyPoolExhausted, true);
  assert.equal(bank.poolScope, 'shared_by_all_players_in_the_same_game');
});

test('las 600 preguntas añadidas se distribuyen en 50 por cada libro solicitado', () => {
  const bank = loadBank();
  const expanded = bank.questions.filter(question => question.book);
  assert.equal(bank.expandedQuestionCount, 600);
  assert.equal(expanded.length, 600);
  assert.deepEqual(bank.bookDistribution, expectedBooks);
  for (const [book, count] of Object.entries(expectedBooks)) {
    assert.equal(expanded.filter(question => question.book === book).length, count, book);
  }
  assert.deepEqual(
    Object.fromEntries(['facil','medio','dificil'].map(difficulty => [
      difficulty,
      expanded.filter(question => question.difficulty === difficulty).length
    ])),
    { facil:200, medio:200, dificil:200 }
  );
});

test('las 900 preguntas tienen IDs únicos, cuatro opciones y referencias en los tres idiomas', () => {
  const bank = loadBank();
  const ids = bank.questions.map(question => question.id);
  assert.equal(new Set(ids).size, 900);
  for (const question of bank.questions) {
    assert.ok(question.question);
    assert.ok(question.biblicalReference);
    assert.equal(question.options.length, 4);
    assert.equal(new Set(question.options).size, 4);
    assert.ok(Number.isInteger(question.correctAnswerIndex));
    assert.ok(question.correctAnswerIndex >= 0 && question.correctAnswerIndex <= 3);
    assert.equal(question.options[question.correctAnswerIndex], question.correctAnswer);
    for (const language of ['pt','en']) {
      assert.ok(question.translations[language].question);
      assert.equal(question.translations[language].options.length, 4);
      assert.equal(new Set(question.translations[language].options).size, 4);
      assert.ok(question.translations[language].biblicalReference);
      assert.equal(question.translations[language].options[question.correctAnswerIndex], question.translations[language].correctAnswer);
    }
  }
});

test('la selección devuelve pregunta, opciones y referencia en el idioma solicitado', () => {
  const bank = loadBank();
  const question = bank.questions.find(item => item.difficulty === 'facil');
  const result = selectQuestionForTurn([question], 'facil', {facil:[],medio:[],dificil:[]}, () => 0, 'en');
  assert.equal(result.question.question, question.translations.en.question);
  assert.equal(result.question.biblicalReference, question.translations.en.biblicalReference);
  assert.equal(result.options.find(option => option.correct).text, question.translations.en.options[question.correctAnswerIndex]);
});

test('la selección conserva las 300 preguntas difíciles sin repetirlas dentro del ciclo', () => {
  const bank = loadBank().questions.filter(question => question.difficulty === 'dificil');
  let usedIds = {facil:[],medio:[],dificil:[]};
  const chosen = new Set();
  for(let index=0;index<300;index+=1){
    const result = selectQuestionForTurn(bank,'dificil',usedIds,()=>0.37,'pt');
    assert.equal(chosen.has(result.question.id),false);
    chosen.add(result.question.id);
    usedIds = result.usedIds;
  }
  assert.equal(chosen.size,300);
  assert.equal(usedIds.dificil.length,300);
  const restarted=selectQuestionForTurn(bank,'dificil',usedIds,()=>0.37,'pt');
  assert.equal(restarted.cycleRestarted,true);
});
