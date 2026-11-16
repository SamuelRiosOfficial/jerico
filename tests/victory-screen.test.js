import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('la pantalla de victoria normal enlaza a Hope Media y conserva volver al menú', () => {
  const app = read('../src/App.jsx');
  assert.match(app, /className="primary hope-media-link" href="https:\/\/hopemedia\.umch\.org\.mx\/" target="_blank" rel="noopener noreferrer"/);
  assert.match(app, /\{t\.hopeMedia\}/);
  assert.match(app, /className="secondary" type="button" onClick=\{resetGame\}>\{t\.return\}/);
});

test('la pantalla de victoria online también muestra el enlace a Hope Media', () => {
  const online = read('../src/online/OnlineGameView.jsx');
  assert.match(online, /className="primary hope-media-link" href="https:\/\/hopemedia\.umch\.org\.mx\/" target="_blank" rel="noopener noreferrer"/);
  assert.match(online, /\{gameText\.hopeMedia \|\| 'Visitar Hope Media'\}/);
  assert.match(online, /className="secondary" type="button" disabled=\{busy\} onClick=\{onExit\}/);
});

test('el título de victoria se mantiene en una sola línea y cabe dentro del panel', () => {
  const css = read('../src/responsive.css');
  assert.match(css, /\.victory-overlay\s*\{[^}]*container-type:\s*inline-size/s);
  assert.match(css, /\.victory-screen h1\s*\{[^}]*font-size:\s*clamp\(16px,\s*5cqw,\s*40px\)/s);
  assert.match(css, /\.victory-screen h1\s*\{[^}]*white-space:\s*nowrap/s);
  assert.match(css, /\.victory-screen h1\s*\{[^}]*overflow:\s*visible/s);
  assert.match(css, /\.victory-screen \.hope-media-link\s*\{[^}]*width:\s*min\(340px,\s*100%\)/s);
});

test('Hope Media button label exists in Spanish, Portuguese, and English', () => {
  const locales = read('../src/gameLocales.js');
  assert.match(locales, /hopeMedia:'Visitar Hope Media'/);
  assert.match(locales, /hopeMedia:'Visitar a Hope Media'/);
  assert.match(locales, /hopeMedia:'Visit Hope Media'/);
});
