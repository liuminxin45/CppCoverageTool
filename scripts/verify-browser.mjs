import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createApp } from '../server/app.mjs';
import { generateReport } from '../server/report.mjs';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { defaults } from '../server/coverage.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const expectedVersion = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')).version;
const verification = path.join(root, '.verification', 'browser');
await mkdir(verification, { recursive: true });
await mkdir(path.join(root, 'docs', 'screenshots'), { recursive: true });
let program = 'C:\\Program Files\\OpenCppCoverage\\OpenCppCoverage.exe';
const app = await createApp({ dataDirectory: verification, platform: 'win32', detect: async () => program, launch: () => {
  const child = new EventEmitter(); child.stdout = new PassThrough(); child.stderr = new PassThrough();
  setTimeout(() => { child.stderr.write('Synthetic process failure for UI verification.\n'); child.emit('close', 5); }, 300);
  return child;
} });
await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${app.server.address().port}`;
const channel = process.env.COVERAGE_BROWSER || 'msedge';
const browser = await chromium.launch(channel === 'chromium' ? {} : { channel });
const errors = [];
const evidence = [];
try {
  for (const viewport of [{ width: 1920, height: 1080 }, { width: 1280, height: 800 }]) {
    for (const theme of ['light', 'dark']) {
      await fetch(`${url}/api/settings`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Coverage-Client': '1' }, body: JSON.stringify({ ...defaults(), output: 'C:\\Coverage\\reports' }) });
      const context = await browser.newContext({ viewport, colorScheme: theme });
      const page = await context.newPage();
      await page.route('**/api/state', async route => {
        const response = await route.fetch();
        const state = await response.json();
        await route.fulfill({ response, json: { ...state, job: null } });
      });
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error' && !message.text().includes('status of 400')) errors.push(message.text()); });
      await page.goto(url); await page.getByLabel('Target executable', { exact: true }).waitFor();
      await page.screenshot({ path: path.join(root, `docs/screenshots/workspace-${theme}-${viewport.width}.png`) });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
      const typography = await page.getByLabel('Target executable', { exact: true }).evaluate(element => {
        const style = getComputedStyle(element); return { size: style.fontSize, line: style.lineHeight, expected: style.getPropertyValue('--desktop-font-size-body').trim(), expectedLine: style.getPropertyValue('--desktop-line-height-ui').trim() };
      });
      assert.equal(typography.size, typography.expected); assert.equal(typography.line, typography.expectedLine);
      await page.getByLabel('Target executable', { exact: true }).fill('C:\\draft path\\app.exe');
      await page.getByRole('tab', { name: 'Merge reports', exact: true }).click();
      await page.getByLabel('Directory containing COV files').fill('C:\\draft merge');
      await page.screenshot({ path: path.join(root, `docs/screenshots/merge-${theme}-${viewport.width}.png`) });
      await page.getByRole('tab', { name: 'Run coverage', exact: true }).click();
      assert.equal(await page.getByLabel('Target executable', { exact: true }).inputValue(), 'C:\\draft path\\app.exe');
      await page.getByRole('combobox', { name: 'Appearance' }).click(); await page.getByRole('option', { name: theme === 'light' ? 'Dark' : 'Light', exact: true }).click();
      assert.equal(await page.getByLabel('Target executable', { exact: true }).inputValue(), 'C:\\draft path\\app.exe');
      await page.getByRole('button', { name: 'About', exact: true }).click(); await page.getByRole('dialog').waitFor();
      assert.ok((await page.getByRole('dialog').innerText()).includes(`Version ${expectedVersion}`));
      await page.screenshot({ path: path.join(root, `docs/screenshots/about-${theme}-${viewport.width}.png`) });
      await page.keyboard.press('Escape'); await page.getByRole('dialog').waitFor({ state: 'hidden' });
      await page.waitForFunction(() => document.activeElement?.textContent === 'About');
      await page.getByRole('button', { name: 'Save settings', exact: true }).click();
      await page.getByText('Settings saved', { exact: true }).first().waitFor();
      await page.unroute('**/api/state');
      await page.getByRole('button', { name: 'Run coverage', exact: true }).click();
      await page.getByRole('alert').waitFor(); assert.equal(await page.getByLabel('Target executable', { exact: true }).inputValue(), 'C:\\draft path\\app.exe');
      await page.getByLabel('Target executable', { exact: true }).fill(process.execPath);
      await page.getByLabel('Source directory', { exact: true }).fill(path.join(root, 'tests'));
      await page.getByLabel('Report directory', { exact: true }).fill(path.join(verification, 'outputs'));
      const previousJobId = app.getJob()?.id;
      await page.getByRole('button', { name: 'Run coverage', exact: true }).click();
      for (let attempt = 0; attempt < 100; attempt++) {
        const latest = app.getJob();
        if (latest?.id !== previousJobId && latest?.status === 'failed') break;
        await page.waitForTimeout(100);
      }
      const latest = app.getJob();
      assert.ok(latest?.id !== previousJobId && latest?.status === 'failed', 'The new mock process must finish before inspecting its UI.');
      await page.waitForFunction(output => document.querySelector('.output-path')?.textContent === output && document.querySelector('.execution-log')?.textContent?.includes('exit code 5'), latest.output);
      assert.ok((await page.getByLabel('Execution log').innerText()).includes('exit code 5'));
      await page.screenshot({ path: path.join(verification, `failure-${theme}-${viewport.width}.png`) });
      evidence.push({ viewport, theme, typography, routes: ['coverage', 'merge', 'about', 'validation error', 'process failure'], draftsRetained: true });
      await context.close();
    }
  }
  const scaled = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1.25, colorScheme: 'dark' });
  const scaledPage = await scaled.newPage(); await scaledPage.goto(url); await scaledPage.getByLabel('Target executable', { exact: true }).waitFor();
  await scaledPage.screenshot({ path: path.join(verification, 'workspace-scale-125.png') }); await scaled.close();
  // Missing-engine state is visible and disables execution.
  program = null;
  const missing = await browser.newPage(); await missing.goto(url); await missing.getByText('OpenCppCoverage is not installed', { exact: true }).waitFor();
  assert.equal(await missing.getByRole('button', { name: 'Run coverage', exact: true }).isDisabled(), true); await missing.close();

  const reportDirectory = path.join(verification, 'report'); const sources = path.join(reportDirectory, 'source');
  await mkdir(sources, { recursive: true });
  await writeFile(path.join(sources, 'example.cpp'), '// Synthetic coverage example\nint choose(bool flag) {\n  if (flag) return 1;\n  return 0;\n}\n// </script><script>window.pwned=1</script>$&\n');
  await writeFile(path.join(reportDirectory, 'coverage.xml'), '<coverage><packages><package><classes><class filename="example.cpp"><lines><line number="2" hits="1"/><line number="3" hits="0"/><line number="4" hits="1"/></lines></class><class filename="library.cpp"><lines><line number="5" hits="1"/><line number="6" hits="1"/></lines></class></classes></package></packages></coverage>');
  await generateReport({ output: reportDirectory, mode: 'coverage', sources, startedAt: new Date().toISOString() });
  const report = await browser.newPage({ viewport: { width: 1280, height: 800 }, colorScheme: 'light' });
  report.on('pageerror', error => errors.push(error.message));
  await report.goto(pathToFileURL(path.join(reportDirectory, 'html/index.html')).href);
  assert.equal(await report.locator('#total-rate').innerText(), '80.0%');
  await report.screenshot({ path: path.join(root, 'docs/screenshots/report-light-1280.png') });
  await report.getByLabel('Show', { exact: true }).selectOption('gaps'); assert.equal(await report.locator('#files tr').count(), 1);
  await report.getByRole('button', { name: 'Inspect example.cpp' }).click(); await report.getByRole('dialog').waitFor();
  assert.equal(await report.evaluate(() => window.pwned), undefined);
  assert.ok((await report.locator('#source-lines').innerText()).includes('</script>'));
  await report.getByRole('button', { name: 'Next uncovered line' }).click(); assert.equal(await report.locator('.source-line.current').getAttribute('data-line'), '3');
  await report.getByLabel('Only uncovered lines').check(); assert.equal(await report.locator('.source-line').count(), 1);
  await report.screenshot({ path: path.join(root, 'docs/screenshots/source-light-1280.png') });
  await report.keyboard.press('Escape'); await report.getByRole('dialog').waitFor({ state: 'hidden' });
  assert.equal(await report.evaluate(() => document.activeElement?.textContent), 'example.cpp');
  await report.getByRole('button', { name: 'Switch theme' }).click();
  await report.screenshot({ path: path.join(root, 'docs/screenshots/report-dark-1280.png') });
  await report.getByLabel('Find a file').fill('not-a-file'); assert.equal(await report.locator('#empty').isVisible(), true);
  await report.close();
  assert.deepEqual(errors, []);
  await writeFile(path.join(verification, 'validation.json'), JSON.stringify({ checks: evidence, scaling: '125% deviceScaleFactor emulation', report: ['offline file', 'filters', 'line hits', 'source escaping', 'uncovered navigation', 'Escape and focus return', 'themes', 'empty search'], errors }, null, 2));
  console.log('Browser checks passed in both themes at 1920×1080 and 1280×800, plus 125% scale emulation.');
} finally { await browser.close(); app.server.closeAllConnections(); await new Promise(resolve => app.server.close(resolve)); }
