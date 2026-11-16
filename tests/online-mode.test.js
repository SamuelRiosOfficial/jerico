import test from 'node:test';
import assert from 'node:assert/strict';
import { DIFFICULTY_STEPS, TOTAL_STEPS, resolveAnswer, nextAvailableCharacter } from '../src/gameEngine.js';
import { getAvailableCharacters, getFirstAvailableCharacter } from '../src/online/characterSelection.js';

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

test('online character picker hides characters already selected in the room', () => {
  const characters = [{ id:'warrior' }, { id:'soldier' }, { id:'trumpeter' }, { id:'woman' }];
  assert.deepEqual(getAvailableCharacters(characters, ['warrior', 'woman']), [
    { id:'soldier' }, { id:'trumpeter' }
  ]);
  assert.equal(getFirstAvailableCharacter(characters, ['warrior']), 'soldier');
  assert.equal(getFirstAvailableCharacter(characters, ['warrior','soldier','trumpeter','woman']), '');
});


test('online character sprite rows stay inside the selected character frame', async () => {
  const { getCharacterSpriteRow, getCharacterSpritePosition } = await import('../src/online/characterSelection.js');
  assert.equal(getCharacterSpriteRow('warrior'), 0);
  assert.equal(getCharacterSpriteRow('soldier'), 1);
  assert.equal(getCharacterSpriteRow('trumpeter'), 2);
  assert.equal(getCharacterSpriteRow('woman'), 3);
  assert.equal(getCharacterSpritePosition('trumpeter'), (2 * 100) / 3);
  assert.equal(getCharacterSpritePosition('woman'), 100);
  assert.equal(getCharacterSpriteRow('unknown'), 0);
});


test('online progress uses the same five six-step scenes as local play', async () => {
  const { sceneIndexForStep, getJourneyMapPosition } = await import('../src/gameEngine.js');
  assert.equal(sceneIndexForStep(0), 0);
  assert.equal(sceneIndexForStep(5), 0);
  assert.equal(sceneIndexForStep(6), 1);
  assert.equal(sceneIndexForStep(12), 2);
  assert.equal(sceneIndexForStep(18), 3);
  assert.equal(sceneIndexForStep(24), 4);
  assert.equal(sceneIndexForStep(30), 4);
  const start = getJourneyMapPosition(0);
  const firstStop = getJourneyMapPosition(6);
  const finalStop = getJourneyMapPosition(30);
  assert.ok(start.x < firstStop.x);
  assert.ok(firstStop.x < finalStop.x);
  assert.ok(Number.isFinite(finalStop.y));
});
