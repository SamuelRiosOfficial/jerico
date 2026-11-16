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


test('los personajes del mapa se recortan desde el atlas mediante una imagen HTML visible', () => {
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const expectedRows = { warrior: 0, soldier: 1, trumpeter: 2, woman: 3 };
  for (const [character, row] of Object.entries(expectedRows)) {
    assert.match(app, new RegExp(`${character}: ${row}`), `Fila incorrecta para ${character}`);
  }

  assert.match(app, /ASSET\('characters-sprites\.webp'\)/);
  assert.match(app, /top: \`\$\{row \* -100\}%\`/);
  assert.match(app, /<JourneyMapCharacter character=\{player\.character\} \/>/);
  assert.match(app, /<JourneyMapCharacter character=\{player\.character\} variant="dock" \/>/);

  const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
  assert.match(css, /\.journey-map-character\s*\{[^}]*overflow:hidden/s);
  assert.match(css, /\.journey-map-character>img\s*\{[^}]*width:300%;height:400%/s);
  assert.match(css, /aspect-ratio:6\/11/);
  assert.doesNotMatch(app, /character-\$\{character\.id\}\.svg/);
});


test('la pantalla de victoria mantiene el saludo en una fila y enlaza a Hope Media', () => {
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(app, /<h1 className="victory-title">\{t\.win\}<\/h1>/);
  assert.match(app, /<a className="primary victory-learn-more" href="https:\/\/hopemedia\.umch\.org\.mx\/">Aprender más de la Biblia<\/a>/);

  const responsive = readFileSync(new URL('../src/responsive.css', import.meta.url), 'utf8');
  assert.match(responsive, /\.victory-screen h1\.victory-title\s*\{[^}]*white-space:\s*nowrap/s);
  assert.match(responsive, /\.victory-screen \.victory-learn-more\s*\{/);
});
