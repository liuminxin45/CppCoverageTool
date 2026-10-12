import { chromium } from 'playwright';
import { mkdir, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.mjs';

const root = process.cwd();
const verification = path.join(root, '.verification', 'cdp-demo');
const screenshots = path.join(root, 'docs', 'screenshots');
const executable = path.join(root, '.verification', 'coverage-demo', 'CoverageDemo.exe');
await access(executable);
await mkdir(verification, { recursive: true }); await mkdir(screenshots, { recursive: true });
const app = await createApp({ dataDirectory: path.join(verification, 'settings') });
await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${app.server.address().port}`;
let browser;
const errors = [];
try {
  // CDP travels over Chromium's isolated pipe; no native desktop automation or exposed debug port is needed.
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext();
  async function capture(page, name) {
    const session = await context.newCDPSession(page);
    const image = await session.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    await writeFile(path.join(screenshots, name), Buffer.from(image.data, 'base64'));
    await session.detach();
  }
  const page = await context.newPage();
  await page.setViewportSize({ width: 1440, height: 1000 });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url);
  await page.getByLabel('Target executable', { exact: true }).fill(executable);
  await page.getByLabel('Source directory', { exact: true }).fill(path.join(root, 'examples', 'coverage-demo'));
  await page.getByLabel('Report directory', { exact: true }).fill(path.join(verification, 'runs'));
  await page.getByRole('button', { name: 'Run coverage', exact: true }).click();
  await page.getByText('completed', { exact: true }).waitFor({ timeout: 60000 });
  const job = app.getJob(); assert.equal(job.status, 'completed', job.log);
  async function theme(value) {
    await page.getByRole('combobox', { name: 'Appearance' }).click();
    await page.getByRole('option', { name: value, exact: true }).click();
    await page.waitForTimeout(150);
  }
  await theme('Light'); await capture(page, 'demo-workspace-light.png');
  await theme('Dark'); await capture(page, 'demo-workspace-dark.png');
  await page.getByRole('tab', { name: 'Merge reports', exact: true }).click();
  await page.getByLabel('Directory containing COV files').fill(path.join(verification, 'runs'));
  await page.getByLabel('Report directory', { exact: true }).fill(path.join(verification, 'merged'));
  await capture(page, 'demo-merge-dark.png');
  const report = await context.newPage();
  await report.setViewportSize({ width: 1440, height: 1100 });
  report.on('pageerror', error => errors.push(error.message));
  await report.goto(pathToFileURL(path.join(job.output, 'html', 'index.html')).href);
  const data = JSON.parse(await report.locator('#report-data').textContent());
  assert.ok(data.files.length >= 3); assert.ok(data.covered > 0 && data.covered < data.total);
  assert.ok(data.files.some(file => file.source));
  if (await report.evaluate(() => document.documentElement.classList.contains('dark'))) await report.getByRole('button', { name: 'Switch theme' }).click();
  await capture(report, 'demo-report-light.png');
  await report.getByRole('button', { name: /Inspect .*pricing\.cpp/ }).click();
  await report.getByRole('button', { name: 'Next uncovered line' }).click();
  await capture(report, 'demo-source-light.png');
  await report.keyboard.press('Escape');
  await report.getByRole('button', { name: 'Switch theme' }).click();
  await capture(report, 'demo-report-dark.png');
  assert.deepEqual(errors, []);
  await writeFile(path.join(verification, 'capture.json'), JSON.stringify({ transport: 'CDP over isolated Chromium pipe', command: 'Page.captureScreenshot', demo: 'examples/coverage-demo', engine: job.status, files: data.files.length, covered: data.covered, total: data.total, report: path.join(job.output, 'html/index.html'), screenshots: 6, errors }, null, 2));
  console.log(`CDP screenshots captured from a real run: ${data.covered}/${data.total} executable lines, ${data.files.length} files.`);
} finally {
  if (browser) await browser.close();
  await app.stop(); app.server.closeAllConnections(); await new Promise(resolve => app.server.close(resolve));
}
