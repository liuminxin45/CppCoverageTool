import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import http from 'node:http';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../server/app.mjs';
import { defaults } from '../server/coverage.mjs';

async function fixture(t, options = {}) {
  const dataDirectory = await mkdtemp(path.join(os.tmpdir(), 'cpp-coverage-api-'));
  const app = await createApp({ dataDirectory, detect: async () => null, ...options });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { app.server.closeAllConnections(); await new Promise(resolve => app.server.close(resolve)); await rm(dataDirectory, { recursive: true, force: true }); });
  const url = `http://127.0.0.1:${app.server.address().port}`;
  const post = (endpoint, value, headers = {}) => fetch(`${url}/api/${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Coverage-Client': '1', ...headers }, body: JSON.stringify(value) });
  return { app, url, post, dataDirectory };
}
test('local API rejects cross-origin, forged hosts and plain browser form requests', async t => {
  const { url, post } = await fixture(t);
  assert.equal((await post('settings', defaults(), { Origin: 'https://example.com' })).status, 403);
  const forgedHost = await new Promise(resolve => {
    http.get(`${url}/api/state`, { headers: { Host: 'evil.example' } }, response => { response.resume(); resolve(response.statusCode); });
  });
  assert.equal(forgedHost, 403);
  assert.equal((await fetch(`${url}/api/settings`, { method: 'POST', body: '{}' })).status, 403);
  assert.equal((await fetch(`${url}/api/state`, { headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
});
test('settings persist and malformed requests preserve the saved configuration', async t => {
  const { post, url, dataDirectory } = await fixture(t);
  const settings = { ...defaults(), target: 'C:\\a path\\app.exe' };
  assert.equal((await post('settings', settings)).status, 200);
  assert.equal((await post('settings', { optimized: 'not a boolean' })).status, 400);
  assert.equal((await (await fetch(`${url}/api/state`)).json()).settings.target, settings.target);
  assert.equal(JSON.parse(await readFile(path.join(dataDirectory, 'settings.json'), 'utf8')).target, settings.target);
});
test('launch validation, concurrency lock, process failure and bounded logs', async t => {
  let launched;
  const { post, url, dataDirectory } = await fixture(t, { platform: 'win32', detect: async () => process.execPath,
    launch: () => { const process = new EventEmitter(); process.stdout = new PassThrough(); process.stderr = new PassThrough(); launched = process; return process; } });
  assert.equal((await post('run', { ...defaults(), target: 'missing.exe' })).status, 400);
  const settings = { ...defaults(), target: process.execPath, sources: dataDirectory, output: path.join(dataDirectory, 'output') };
  assert.equal((await post('run', settings)).status, 202);
  assert.equal((await post('run', settings)).status, 409);
  launched.stdout.write('x'.repeat(300000)); launched.emit('close', 7);
  const state = await (await fetch(`${url}/api/state`)).json();
  assert.equal(state.job.status, 'failed'); assert.equal(state.job.exitCode, 7); assert.ok(state.job.log.length <= 256 * 1024);
  assert.equal((await post('open-report', {})).status, 400);
});
