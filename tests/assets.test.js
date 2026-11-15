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
    'stage-jericho-scene.webp',
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


test('el tablero utiliza el recurso limpio y proporcional para Jericó', () => {
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
  assert.ok(app.includes("id: 'jericho', asset: 'stage-jericho-scene.webp'"));
  assert.ok(app.includes('scene-track-jericho'));
  assert.ok(css.includes('.scene-track-jericho {'));
  assert.ok(css.includes('background-size: cover !important;'));
});
