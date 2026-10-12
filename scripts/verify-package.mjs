import { mkdtemp, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';

const directory = await mkdtemp(path.join(os.tmpdir(), 'cpp-coverage-package-'));
let app;
try {
  await promisify(execFile)('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.resolve('scripts/extract.ps1'), '-Archive', path.resolve('release/CppCoverageTool-2.0.1-windows.zip'), '-Destination', directory], { windowsHide: true });
  const packageRoot = path.join(directory, 'CppCoverageTool-2.0.1-windows');
  const { createApp } = await import(pathToFileURL(path.join(packageRoot, 'server/app.mjs')).href);
  const dataDirectory = path.join(directory, 'data'); const sources = path.join(directory, 'source'); await mkdir(sources);
  await writeFile(path.join(sources, 'sample.cpp'), 'int main() { return 0; }');
  app = await createApp({ dataDirectory, platform: 'win32', detect: async () => process.execPath, launch: (program, args) => {
    const child = new EventEmitter(); child.stdout = new PassThrough(); child.stderr = new PassThrough();
    const xml = args.find(value => value.startsWith('--export_type=cobertura:')).slice('--export_type=cobertura:'.length);
    writeFile(xml, '<coverage><packages><package><classes><class filename="sample.cpp"><lines><line number="1" hits="1"/></lines></class></classes></package></packages></coverage>')
      .then(() => child.emit('close', 0), error => child.emit('error', error));
    return child;
  } });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${app.server.address().port}`;
  const html = await (await fetch(url)).text(); assert.ok(html.includes('CppCoverageTool'));
  const { settings } = await (await fetch(`${url}/api/state`)).json();
  const result = await fetch(`${url}/api/run`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Coverage-Client': '1' }, body: JSON.stringify({ ...settings, target: process.execPath, sources, output: path.join(directory, 'output') }) });
  assert.equal(result.status, 202, await result.text());
  for (let attempt = 0; attempt < 100 && ['running', 'generating'].includes(app.getJob().status); attempt++) await new Promise(resolve => setTimeout(resolve, 50));
  const job = app.getJob(); assert.equal(job.status, 'completed', job.log);
  const report = await readFile(path.join(job.output, 'html/index.html'), 'utf8'); assert.ok(report.includes('int main()'));
  console.log('Extracted ZIP smoke test passed outside the source tree: assets, API, XML parser, UI tokens and report generation.');
} finally {
  if (app) { app.server.closeAllConnections(); await new Promise(resolve => app.server.close(resolve)); }
  if (path.dirname(directory) === os.tmpdir() && path.basename(directory).startsWith('cpp-coverage-package-')) await rm(directory, { recursive: true, force: true });
}
