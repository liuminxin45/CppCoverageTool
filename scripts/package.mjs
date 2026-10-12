import { cp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const releaseRoot = path.join(root, 'release');
const destination = path.join(releaseRoot, 'CppCoverageTool-2.0.0-windows');
if (path.dirname(destination) !== releaseRoot) throw new Error('Invalid package path.');
await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
for (const name of ['dist', 'server', 'docs', 'start.cmd', 'README.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md']) await cp(path.join(root, name), path.join(destination, name), { recursive: true });
await mkdir(path.join(destination, 'resources'), { recursive: true });
await cp(path.join(root, 'node_modules/chatgpt-desktop-kit/dist/tokens.css'), path.join(destination, 'resources/tokens.css'));
await cp(path.join(root, 'node_modules/chatgpt-desktop-kit/LICENSE'), path.join(destination, 'resources/desktop-ui-LICENSE'));
await cp(path.join(root, 'node_modules/chatgpt-desktop-kit/NOTICE.md'), path.join(destination, 'resources/desktop-ui-NOTICE.md'));
await cp(path.join(root, 'node_modules/chatgpt-desktop-kit/dist/THIRD_PARTY_NOTICES.txt'), path.join(destination, 'resources/desktop-ui-THIRD_PARTY_NOTICES.txt'));
for (const name of ['react', 'react-dom']) await cp(path.join(root, 'node_modules', name, 'LICENSE'), path.join(destination, 'resources', `${name}-LICENSE`));
const visited = new Set();
async function copyDependency(name, from) {
  const require = createRequire(path.join(from, 'package.json'));
  let directory;
  let manifest;
  for (const base of require.resolve.paths(name) || []) {
    try {
      const candidate = path.join(base, name);
      const value = JSON.parse(await readFile(path.join(candidate, 'package.json'), 'utf8'));
      if (value.name === name) { directory = candidate; manifest = value; break; }
    } catch { /* next Node package lookup directory */ }
  }
  if (!directory) throw new Error(`Could not resolve runtime package ${name}.`);
  if (visited.has(directory)) return;
  visited.add(directory);
  const relative = path.relative(path.join(root, 'node_modules'), directory);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Runtime dependency is outside node_modules.');
  await cp(directory, path.join(destination, 'node_modules', relative), { recursive: true });
  for (const dependency of Object.keys(manifest.dependencies || {})) await copyDependency(dependency, directory);
}
await copyDependency('fast-xml-parser', root);
await writeFile(path.join(destination, 'package.json'), JSON.stringify({ name: 'cpp-coverage-tool-runtime', version: '2.0.0', private: true, type: 'module', engines: { node: '^22.23.3 || ^24.19.0' } }, null, 2));
const archive = path.join(releaseRoot, 'CppCoverageTool-2.0.0-windows.zip');
await rm(archive, { force: true });
await promisify(execFile)('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(root, 'scripts/archive.ps1'), '-Source', destination, '-Destination', archive], { windowsHide: true });
const hash = createHash('sha256').update(await readFile(archive)).digest('hex');
await writeFile(path.join(releaseRoot, 'SHA256SUMS.txt'), `${hash}  ${path.basename(archive)}\n`);
console.log(`Created ${archive}\nSHA256 ${hash}\nRequires Node.js and OpenCppCoverage; no npm install or compiler is needed.`);
