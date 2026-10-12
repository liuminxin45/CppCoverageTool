import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, writeFile, readFile, rm, mkdir } from 'node:fs/promises';
import { parseCoverage, generateReport, escapeHtml } from '../server/report.mjs';

export const xml = `<coverage><packages><package name="app"><classes><class filename="sample.cpp"><lines><line number="1" hits="2"/><line number="2" hits="0"/></lines></class><class filename="sample.cpp"><lines><line number="1" hits="1"/><line number="3" hits="0"/></lines></class><class filename="empty.cpp"><lines/></class></classes></package></packages></coverage>`;
test('report combines duplicate filenames and executable lines, including zero hits', () => {
  const files = parseCoverage(xml);
  assert.equal(files.length, 2); assert.equal(files[0].total, 3); assert.equal(files[0].covered, 1);
  assert.deepEqual(files[0].lines, [[1, 3], [2, 0], [3, 0]]);
  assert.equal(files[1].rate, null);
});
test('report rejects XML entities and invalid document shapes', () => {
  assert.throws(() => parseCoverage('<!DOCTYPE coverage><coverage/>'), /entities/);
  assert.throws(() => parseCoverage('<wrong/>'), /package/);
  assert.throws(() => parseCoverage('<coverage><packages></coverage>'), /malformed/);
  assert.deepEqual(parseCoverage('<coverage><packages/></coverage>'), []);
});
test('standalone HTML embeds escaped source without script injection or replacement expansion', async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'cpp-coverage-report-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const source = path.join(directory, 'source'); await mkdir(source);
  await writeFile(path.join(source, 'sample.cpp'), 'const char *x = "</script><script>window.pwned=1</script>$&";\nreturn 0;');
  await writeFile(path.join(directory, 'coverage.xml'), xml);
  const summary = await generateReport({ output: directory, mode: 'coverage', sources: source, startedAt: new Date().toISOString() });
  assert.deepEqual(summary, { covered: 1, total: 3, files: 2 });
  const html = await readFile(path.join(directory, 'html', 'index.html'), 'utf8');
  assert.ok(!html.includes('<script>window.pwned'));
  const data = JSON.parse(html.match(/<script id="report-data" type="application\/json">(.*?)<\/script>/s)[1]);
  assert.ok(data.files[0].source[0].includes('</script>')); assert.ok(data.files[0].source[0].includes('$&'));
  assert.equal(escapeHtml('<"&'), '&lt;&quot;&amp;');
});
