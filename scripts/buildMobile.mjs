import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const nativeBuild = process.argv.includes('--native');

function runNodeScript(scriptName) {
  const scriptPath = path.join(projectRoot, 'scripts', scriptName);
  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: projectRoot,
    stdio: 'inherit'
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

runNodeScript('assembleMenuVideo.mjs');
runNodeScript('assembleQuestionBank.mjs');

const viteEntry = path.join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js');
const result = spawnSync(process.execPath, [viteEntry, 'build', '--base=/'], {
  cwd: projectRoot,
  stdio: 'inherit',
  env: {
    ...process.env,
    JERICO_MOBILE_BUILD: '1',
    JERICO_NATIVE_BUILD: nativeBuild ? '1' : '0'
  }
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
