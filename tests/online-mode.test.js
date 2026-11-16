import test from 'node:test';
import assert from 'node:assert/strict';
import { DIFFICULTY_STEPS, TOTAL_STEPS, resolveAnswer, nextAvailableCharacter } from '../gameEngine.js';

test('online mode reuses approved journey scoring rules', () => {
  assert.equal(TOTAL_STEPS, 30);
  assert.deepEqual(DIFFICULTY_STEPS, { facil:1, medio:2, dificil:3 });
  assert.deepEqual(resolveAnswer(27,true,3), { steps:30, won:true });
  assert.deepEqual(resolveAnswer(27,false,3), { steps:27, won:false });
});

test('online room character allocation never duplicates a picked character', () => {
  assert.equal(nextAvailableCharacter(0,1,[0]),1);
  assert.equal(nextAvailableCharacter(0,1,[0,1,2]),3);
});
