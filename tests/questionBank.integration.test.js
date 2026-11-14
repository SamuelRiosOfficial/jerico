import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { validateQuestionBank } from '../src/gameEngine.js';

test('el archivo comprimido real contiene las 120 preguntas aprobadas', () => {
  const encoded = readFileSync(new URL('../public/data/question-bank.json.gz.b64', import.meta.url), 'utf8').trim();
  const bank = JSON.parse(gunzipSync(Buffer.from(encoded, 'base64')).toString('utf8'));
  assert.equal(bank.questionCount, 120);
  assert.deepEqual(validateQuestionBank(bank), { facil: 40, medio: 40, dificil: 40 });
  assert.equal(bank.randomizeQuestionOrder, true);
  assert.equal(bank.randomizeAnswerOrder, true);
  assert.equal(bank.noRepeatUntilDifficultyPoolExhausted, true);
  assert.equal(bank.poolScope, 'shared_by_all_players_in_the_same_game');
});

test('el banco preserva las respuestas correctas y los identificadores son únicos', () => {
  const encoded = readFileSync(new URL('../public/data/question-bank.json.gz.b64', import.meta.url), 'utf8').trim();
  const bank = JSON.parse(gunzipSync(Buffer.from(encoded, 'base64')).toString('utf8'));
  const ids = bank.questions.map((question) => question.id);
  assert.equal(new Set(ids).size, 120);
  for (const question of bank.questions) {
    assert.equal(question.correctAnswer, question.options[question.correctAnswerIndex]);
  }
});
