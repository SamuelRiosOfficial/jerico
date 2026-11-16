import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateQuestionBank } from '../src/gameEngine.js';

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
  validateQuestionBank(bank);
  assert.deepEqual(bank.distribution, { facil:300, medio:300, dificil:300 });
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
  assert.equal(bank.questions.length, 900);
  assert.equal(new Set(bank.questions.map(question => question.id)).size, 900);
  for (const question of bank.questions) {
    assert.ok(question.question);
    assert.ok(question.biblicalReference);
    assert.equal(question.options.length, 4);
    assert.equal(new Set(question.options).size, 4);
    assert.ok(Number.isInteger(question.correctAnswerIndex));
    assert.ok(question.correctAnswerIndex >= 0 && question.correctAnswerIndex <= 3);
    assert.equal(question.options[question.correctAnswerIndex], question.correctAnswer);
    for (const language of ['pt','en']) {
      const translation = question.translations[language];
      assert.ok(translation.question);
      assert.equal(translation.options.length, 4);
      assert.equal(new Set(translation.options).size, 4);
      assert.ok(translation.biblicalReference);
    }
  }
});
