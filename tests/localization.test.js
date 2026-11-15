import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TEXT } from '../src/gameLocales.js';

const languages = ['Español', 'Português', 'English'];
const signature = (value) => {
  if (Array.isArray(value)) return value.map(signature);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, signature(value[key])]));
  }
  return typeof value;
};

test('los tres idiomas contienen el mismo catálogo completo de interfaz', () => {
  for (const language of languages) {
    assert.ok(TEXT[language], `Falta el idioma ${language}`);
    assert.ok(TEXT[language].pageTitle);
    assert.ok(TEXT[language].storyReference);
    assert.equal(TEXT[language].instructionsRules.length, 5);
    assert.equal(TEXT[language].story.length, 5);
    assert.equal(TEXT[language].scenes.length, 5);
    assert.deepEqual(Object.keys(TEXT[language].characters).sort(), ['soldier','trumpeter','warrior','woman']);
  }
  assert.deepEqual(signature(TEXT.Español), signature(TEXT.Português));
  assert.deepEqual(signature(TEXT.Español), signature(TEXT.English));
});

test('no hay etiquetas vacías en los textos de la interfaz', () => {
  const walk = (value, path = 'TEXT') => {
    if (Array.isArray(value)) return value.forEach((entry, index) => walk(entry, `${path}[${index}]`));
    if (value && typeof value === 'object') return Object.entries(value).forEach(([key, entry]) => walk(entry, `${path}.${key}`));
    assert.equal(typeof value, 'string', `${path} debe ser texto`);
    assert.ok(value.trim().length > 0, `${path} no puede estar vacío`);
  };
  for (const language of languages) walk(TEXT[language], `TEXT.${language}`);
});

test('la interfaz consume el catálogo y actualiza el idioma del documento y el título', () => {
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.ok(app.includes("import { TEXT } from './gameLocales.js'"));
  assert.match(app, /document.documentElement.lang = localeCode/);
  assert.match(app, /document.title = t.pageTitle/);
  assert.ok(app.includes("localizedCharacters"));
  assert.ok(app.includes("localizedScenes"));
  assert.ok(app.includes("localizedLevels"));
});
