import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import { createApp } from '../server/app.mjs';
import { defaults } from '../server/coverage.mjs';

test('real OpenCppCoverage: run, complementary merge, custom report and cancellation', { skip: !process.env.COVERAGE_TEST_EXE, timeout: 90000 }, async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'cpp-coverage-real-'));
  const app = await createApp({ dataDirectory: directory });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await app.stop(); app.server.closeAllConnections(); await new Promise(resolve => app.server.close(resolve)); await rm(directory, { recursive: true, force: true }); });
  const url = `http://127.0.0.1:${app.server.address().port}`;
  const post = async (endpoint, value) => { const response = await fetch(`${url}/api/${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Coverage-Client': '1' }, body: JSON.stringify(value) }); const data = await response.json(); assert.ok(response.ok, JSON.stringify(data)); return data; };
  async function finish() {
    for (let attempt = 0; attempt < 300; attempt++) {
      const job = app.getJob();
      if (!['running', 'stopping', 'generating'].includes(job.status)) return job;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('Coverage process did not finish.');
  }
  const settings = { ...defaults(), target: process.env.COVERAGE_TEST_EXE, sources: path.resolve('tests'), output: path.join(directory, 'inputs'), optimized: false, coverChildren: false };
  await post('run', settings); const first = await finish(); assert.equal(first.status, 'completed', first.log);
  await post('run', { ...settings, targetArguments: '["alternate"]' }); const second = await finish(); assert.equal(second.status, 'completed', second.log);
  await post('merge', { ...settings, merge: settings.output, output: path.join(directory, 'merged') });
  const merged = await finish(); assert.equal(merged.status, 'completed', merged.log); assert.equal(merged.inputCount, 2);
  const firstHtml = await readFile(path.join(first.output, 'html', 'index.html'), 'utf8');
  const mergedHtml = await readFile(path.join(merged.output, 'html', 'index.html'), 'utf8');
  const data = html => JSON.parse(html.match(/<script id="report-data" type="application\/json">(.*?)<\/script>/s)[1]);
  assert.ok(data(mergedHtml).covered > data(firstHtml).covered);
  assert.ok(data(firstHtml).files.some(file => file.source?.some(line => line.includes('alternate branch'))));
  await post('run', { ...settings, targetArguments: '["sleep"]' });
  await new Promise(resolve => setTimeout(resolve, 600));
  await post('stop', {}); const stopped = await finish(); assert.equal(stopped.status, 'cancelled', stopped.log);
});
