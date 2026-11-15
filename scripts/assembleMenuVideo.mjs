import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const sourceFiles = [
  'media-source/menu-video-00.b64part',
  'media-source/menu-video-01.b64part',
  'media-source/menu-video-02.b64part',
  'media-source/menu-video-03.b64part'
];

const encoded = sourceFiles
  .map((file) => readFileSync(resolve(file), 'utf8').trim())
  .join('');

if (!encoded || encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]+=*$/.test(encoded)) {
  throw new Error('Las partes del video del menú están incompletas o contienen caracteres inválidos.');
}

const video = Buffer.from(encoded, 'base64');
if (video.subarray(4, 8).toString('ascii') !== 'ftyp' || video.length < 30000) {
  throw new Error('El video del menú no es un MP4 completo.');
}

const destination = resolve('public/assets/jerico-menu-loop.mp4');
mkdirSync(dirname(destination), { recursive: true });
writeFileSync(destination, video);
