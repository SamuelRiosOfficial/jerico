import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');

test('el modo normal inicia con un jugador seleccionado', () => {
  assert.match(app, /const \[playerCount, setPlayerCount\] = useState\(1\);/);
  assert.match(app, /setPlayerCount\(1\);/);
  assert.match(app, /\[1, 2, 3, 4\]\.map\(\(number\)/);
});

test('el modo normal permite cambiar de uno a cuatro jugadores', () => {
  assert.match(app, /onClick=\{\(\) => setPlayerCount\(number\)\}/);
  assert.match(app, /names\.slice\(0, playerCount\)/);
  assert.match(app, /selections\.length !== playerCount/);
});
