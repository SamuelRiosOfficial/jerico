import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const assets = [
  ['media-source/journey-map.webp.b64', 'public/assets/journey-map.webp'],
  ['media-source/jerico-menu-loop.mp4.b64', 'public/assets/jerico-menu-loop.mp4']
];

for (const [source, destination] of assets) {
  const sourcePath = resolve(source);
  const targetPath = resolve(destination);
  const encoded = readFileSync(sourcePath, 'utf8').replace(/\\s+/g, '');
  if (!encoded || !/^[A-Za-z0-9+/]+=*$/.test(encoded)) {
    throw new Error(`El archivo multimedia codificado no es válido: ${source}`);
  }
  mkdirSync(dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, Buffer.from(encoded, 'base64'));
}
