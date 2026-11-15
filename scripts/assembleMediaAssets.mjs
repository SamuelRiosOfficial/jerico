import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const assets = [
  ['map-part-', 'public/assets/journey-map.webp'],
  ['video-part-', 'public/assets/jerico-menu-loop.mp4']
];

for (const [prefix, destination] of assets) {
  const sourceDirectory = resolve('media-source');
  const partFiles = readdirSync(sourceDirectory)
    .filter((name) => name.startsWith(prefix) && name.endsWith('.b64part'))
    .sort();

  if (!partFiles.length) {
    throw new Error(`No se encontraron las partes multimedia para ${prefix}`);
  }

  const encoded = partFiles
    .map((name) => readFileSync(resolve(sourceDirectory, name), 'utf8').trim())
    .join('');

  if (!encoded || !/^[A-Za-z0-9+/]+=*$/.test(encoded)) {
    throw new Error(`El archivo multimedia codificado no es válido: ${prefix}`);
  }

  const targetPath = resolve(destination);
  mkdirSync(dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, Buffer.from(encoded, 'base64'));
}
