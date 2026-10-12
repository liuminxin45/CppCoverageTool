import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { readFile, writeFile, mkdir, rename, stat, realpath } from 'node:fs/promises';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { StringDecoder } from 'node:string_decoder';
import { defaults, normalizeSettings, requirePath, coverageArguments, mergeArguments, findCoverageFiles, detectCoverage, isInside } from './coverage.mjs';
import { generateReport } from './report.mjs';

const exec = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

export async function createApp({ dataDirectory = path.join(process.env.LOCALAPPDATA || os.homedir(), 'CppCoverageTool'),
  platform = process.platform, detect = detectCoverage, launch = spawn, development = false } = {}) {
  const settingsFile = path.join(dataDirectory, 'settings.json');
  let settings = defaults();
  let settingsError = null;
  try { settings = normalizeSettings(JSON.parse(await readFile(settingsFile, 'utf8'))); }
  catch (error) { if (error.code !== 'ENOENT') settingsError = 'Saved settings could not be read. Your original file has been preserved.'; }
  let job = null;
  let child = null;
  let starting = false;
  let pickerOpen = false;
  let saveQueue = Promise.resolve();
  function log(text) {
    if (!job || !text) return;
    job.log = (job.log + text).slice(-256 * 1024);
  }
  function publicJob() { return job ? { ...job } : null; }
  async function save(value) {
    const next = normalizeSettings(value);
    const pending = saveQueue.then(async () => {
      await mkdir(dataDirectory, { recursive: true });
      const temporary = `${settingsFile}.${randomUUID()}.tmp`;
      await writeFile(temporary, JSON.stringify(next, null, 2), { mode: 0o600 });
      await rename(temporary, settingsFile);
      settings = next;
      settingsError = null;
    });
    saveQueue = pending.catch(() => {});
    await pending;
  }
  async function start(mode, raw) {
    if (starting || child) throw Object.assign(new Error('A coverage process is already running.'), { status: 409 });
    starting = true;
    try {
      if (platform !== 'win32') throw new Error('Coverage execution requires Windows and OpenCppCoverage.');
      const value = normalizeSettings(raw);
      if (!value.output || !path.isAbsolute(value.output)) throw new Error('Output directory must be an absolute local path.');
      const program = await detect();
      if (!program) throw new Error('OpenCppCoverage was not found. Install it and add it to PATH.');
      let files;
      if (mode === 'coverage') {
        await requirePath(value.target, 'file', 'Target executable');
        if (!/\.exe$/i.test(value.target)) throw new Error('Target must be a Windows .exe file.');
        await requirePath(value.sources, 'directory', 'Source directory');
      } else {
        await requirePath(value.merge, 'directory', 'COV directory');
        // Resolve existing directories to prevent aliases/junctions from feeding generated results back into a merge.
        await mkdir(value.output, { recursive: true });
        files = await findCoverageFiles(await realpath(value.merge), await realpath(value.output));
        if (!files.length) throw new Error('No .cov files were found outside the output directory.');
      }
      const output = path.join(value.output, `${mode}-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`);
      const args = mode === 'coverage' ? coverageArguments(value, output) : mergeArguments(files, output);
      // Windows CreateProcess has a 32,767-character command-line limit, including quoting.
      if (args.reduce((n, arg) => n + arg.length * 2 + 3, program.length) > 30000) throw new Error('The command is too long. Reduce the number of inputs or arguments.');
      await mkdir(path.join(output, 'html'), { recursive: true });
      await save(value);
      job = { id: randomUUID(), mode, status: 'running', startedAt: new Date().toISOString(), finishedAt: null,
        exitCode: null, output, log: `$ ${JSON.stringify([program, ...args])}\n`, inputCount: files?.length ?? null };
      child = launch(program, args, { cwd: mode === 'coverage' ? path.dirname(value.target) : output, shell: false, windowsHide: true });
      const active = child;
      const decoders = [new StringDecoder('utf8'), new StringDecoder('utf8')];
      active.stdout.on('data', chunk => log(decoders[0].write(chunk)));
      active.stderr.on('data', chunk => log(decoders[1].write(chunk)));
      active.on('error', error => { job.status = 'failed'; log(`\nCould not launch OpenCppCoverage: ${error.message}\n`); });
      active.on('close', async (code) => {
        log(decoders[0].end() + decoders[1].end());
        job.exitCode = code;
        job.status = job.status === 'stopping' ? 'cancelled' : job.status === 'failed' || code !== 0 ? 'failed' : 'completed';
        if (job.status === 'completed') {
          job.status = 'generating';
          log('\nGenerating the CppCoverageTool HTML report…\n');
          try {
            const summary = await generateReport({ output, mode, sources: value.sources, startedAt: job.startedAt });
            log(`Report ready: ${summary.covered}/${summary.total} covered lines in ${summary.files} files.\n`);
            job.status = 'completed';
          } catch (error) { job.status = 'failed'; log(`Report generation failed: ${error.message}\nOriginal XML and COV data remain in the output folder.\n`); }
        }
        job.finishedAt = new Date().toISOString();
        log(`\nProcess ${job.status}${code === null ? '' : ` (exit code ${code})`}.\n`);
        child = null;
      });
      return publicJob();
    } finally { starting = false; }
  }
  async function stop() {
    if (!child || job.status !== 'running') return;
    job.status = 'stopping';
    try {
      if (platform === 'win32') await exec('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true });
      else child.kill('SIGTERM');
    } catch (error) {
      if (child) { job.status = 'running'; throw new Error(`Could not stop the process: ${error.message}`); }
    }
  }
  async function body(request) {
    const parts = []; let bytes = 0;
    for await (const part of request) { bytes += part.length; if (bytes > 128 * 1024) throw Object.assign(new Error('Request is too large.'), { status: 413 }); parts.push(part); }
    try { return JSON.parse(Buffer.concat(parts).toString('utf8')); } catch { throw new Error('Invalid JSON request.'); }
  }
  const server = http.createServer(async (request, response) => {
    const send = (status, value) => { response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); response.end(JSON.stringify(value)); };
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    const address = server.address();
    const hosts = [`127.0.0.1:${address?.port}`, `localhost:${address?.port}`];
    const origin = request.headers.origin;
    const origins = hosts.map(host => `http://${host}`);
    if (development) origins.push('http://127.0.0.1:5173', 'http://localhost:5173');
    if (!hosts.includes(request.headers.host) || request.headers['sec-fetch-site'] === 'cross-site' || (origin && !origins.includes(origin))) return send(403, { error: 'Only local, same-origin requests are allowed.' });
    try {
      const url = new URL(request.url, `http://${request.headers.host}`);
      if (url.pathname.startsWith('/api/')) {
        if (request.method === 'GET' && url.pathname === '/api/state') return send(200, { version: '2.0.0', settings, settingsError, program: await detect(), job: publicJob() });
        if (request.method !== 'POST') return send(405, { error: 'Method not allowed.' });
        if (request.headers['x-coverage-client'] !== '1' || !request.headers['content-type']?.startsWith('application/json')) return send(403, { error: 'A JSON application request is required.' });
        const value = await body(request);
        switch (url.pathname) {
          case '/api/settings': await save(value); return send(200, { settings });
          case '/api/run': return send(202, { job: await start('coverage', value) });
          case '/api/merge': return send(202, { job: await start('merge', value) });
          case '/api/stop': await stop(); return send(200, { job: publicJob() });
          case '/api/pick': {
            if (platform !== 'win32') throw new Error('Native path selection requires Windows. Enter the path manually.');
            if (!['file', 'folder'].includes(value.kind)) throw new Error('Invalid picker type.');
            if (pickerOpen) throw Object.assign(new Error('A path picker is already open.'), { status: 409 });
            pickerOpen = true;
            try {
              const result = await exec('powershell.exe', ['-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass', '-File', path.join(root, 'server', 'picker.ps1'), '-Kind', value.kind], { windowsHide: true, timeout: 300000 });
              return send(200, { path: result.stdout.trim() });
            } finally { pickerOpen = false; }
          }
          case '/api/open-output': {
            if (!job || !['completed', 'failed', 'cancelled'].includes(job.status)) throw new Error('No finished report directory is available.');
            await requirePath(job.output, 'directory', 'Report directory');
            if (platform !== 'win32') throw new Error('Opening a report directory requires Windows.');
            await exec('explorer.exe', [job.output], { windowsHide: true }).catch(error => { if (error.code !== 1) throw error; });
            return send(200, { ok: true });
          }
          case '/api/open-report': {
            if (!job || job.status !== 'completed') throw new Error('No completed HTML report is available.');
            const report = path.join(job.output, 'html', 'index.html');
            await requirePath(report, 'file', 'HTML report');
            if (platform !== 'win32') throw new Error('Opening a report requires Windows.');
            await exec('explorer.exe', [report], { windowsHide: true }).catch(error => { if (error.code !== 1) throw error; });
            return send(200, { ok: true });
          }
          default: return send(404, { error: 'Unknown API endpoint.' });
        }
      }
      if (!['GET', 'HEAD'].includes(request.method)) return send(405, { error: 'Method not allowed.' });
      const relative = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
      const file = path.join(root, 'dist', relative);
      if (!isInside(path.join(root, 'dist'), file)) return send(403, { error: 'Invalid asset path.' });
      const info = await stat(file).catch(() => null);
      if (!info?.isFile()) return send(404, { error: 'Asset not found. Run npm run build first.' });
      response.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
      response.end(request.method === 'HEAD' ? undefined : await readFile(file));
    } catch (error) { send(error.status || 400, { error: error.message }); }
  });
  server.requestTimeout = 310000;
  return { server, stop, getJob: publicJob };
}
