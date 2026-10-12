import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { defaults, normalizeSettings, argumentArray, coverageArguments, mergeArguments, findCoverageFiles, isInside } from '../server/coverage.mjs';

test('arguments preserve spaces, empty values, quotes and backslashes without a shell', () => {
  const settings = { ...defaults(), target: path.resolve('folder with spaces/app.exe'), sources: path.resolve('sources'),
    modules: 'app.exe\nlibrary.dll\nlibrary.dll', excluded: '*vendor*\n*vendor*', targetArguments: JSON.stringify(['', 'a b', '"quote"', 'C:\\path\\']) };
  const args = coverageArguments(settings, path.resolve('report'));
  assert.deepEqual(args.slice(args.indexOf('--') + 1), [settings.target, '', 'a b', '"quote"', 'C:\\path\\']);
  assert.equal(args.filter(v => v === 'library.dll').length, 1);
  assert.equal(args.filter(v => v === '*vendor*').length, 1);
  assert.equal(args.some(v => v.startsWith('--export_type=html')), false);
  assert.ok(args.some(v => v.startsWith('--export_type=cobertura:')));
});
test('advanced options cannot redirect exports or execution', () => {
  for (const flag of ['--', '--export_type=html:elsewhere', '--config_file', '--working_dir', '--input_coverage=a']) {
    assert.throws(() => coverageArguments({ ...defaults(), target: 'app.exe', extraArguments: JSON.stringify([flag]) }, 'out'), /Unsupported/);
  }
  assert.throws(() => coverageArguments({ ...defaults(), target: 'app.exe', extraArguments: '["--excluded_modules"]' }, 'out'), /requires a value/);
  assert.doesNotThrow(() => coverageArguments({ ...defaults(), target: 'app.exe', extraArguments: '["--excluded_modules", "vendor.dll", "--continue_after_cpp_exception"]' }, 'out'));
});
test('malformed argument arrays and settings fail with useful messages', () => {
  for (const value of ['"a"', '[1]', '{"a":1}', '[']) assert.throws(() => argumentArray(value, 'Arguments'), /JSON array/);
  assert.throws(() => normalizeSettings({ coverChildren: 'yes' }), /Invalid setting/);
  assert.throws(() => normalizeSettings({ target: '\0' }), /Invalid setting/);
});
test('recursive merge excludes its output and deduplicates no generated results', async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'cpp-coverage-merge-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const output = path.join(directory, 'reports');
  await mkdir(path.join(directory, 'inputs'), { recursive: true }); await mkdir(output);
  await Promise.all([writeFile(path.join(directory, 'first.COV'), ''), writeFile(path.join(directory, 'inputs', 'second.cov'), ''), writeFile(path.join(output, 'old.cov'), '')]);
  const files = await findCoverageFiles(directory, output);
  assert.equal(files.length, 2);
  assert.ok(files.every(file => !isInside(output, file)));
  await assert.rejects(findCoverageFiles(output, output), /outside/);
  assert.equal(mergeArguments(files, output).filter(v => v.startsWith('--input_coverage=')).length, 2);
});
