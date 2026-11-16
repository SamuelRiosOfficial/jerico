import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

test('todos los recursos gráficos llamados por la interfaz están en public/assets', () => {
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const referenced = [...app.matchAll(/ASSET\('([^']+)'\)/g)].map((match) => match[1]);
  const required = [
    'menu.webp',
    'stage-egypt.webp',
    'stage-red-sea.webp',
    'stage-sinai.webp',
    'stage-jordan.webp',
    'stage-jericho.webp',
    'characters-sprites.webp',
    'wall-1.webp',
    'wall-2.webp',
    'wall-3.webp',
    'wall-4.webp',
    'wall-5.webp'
  ];
  for (const file of [...new Set([...referenced, ...required])]) {
    assert.equal(existsSync(new URL(`../public/assets/${file}`, import.meta.url)), true, `Falta el recurso ${file}`);
  }
});


test('el mapa final está autocontenido e incluye la imagen raster incrustada', () => {
  const map = readFileSync(new URL('../public/assets/journey-map.svg', import.meta.url), 'utf8');
  assert.match(map, /viewBox="0 0 1600 902\.5"/);
  assert.match(map, /<image[\s\S]*data:image\/png;base64,/);
  assert.match(map, /id="editable-stage-labels"/);
});
