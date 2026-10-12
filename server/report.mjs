import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isInside } from './coverage.mjs';

const directory = path.dirname(fileURLToPath(import.meta.url));
const list = value => value == null ? [] : Array.isArray(value) ? value : [value];
const integer = value => Math.max(0, Number.isFinite(Number(value)) ? Math.floor(Number(value)) : 0);
export const escapeHtml = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function parseCoverage(xml) {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('XML document types and entities are not supported.');
  if (XMLValidator.validate(xml) !== true) throw new Error('Coverage XML is malformed.');
  const document = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', parseAttributeValue: false, parseTagValue: false }).parse(xml);
  if (!document.coverage || document.coverage.packages === undefined) throw new Error('The coverage XML has no package data.');
  const sourceRoots = list(document.coverage.sources?.source).map(String);
  const byFile = new Map();
  for (const pkg of list(document.coverage.packages.package)) {
    for (const item of list(pkg.classes?.class)) {
      const filename = String(item.filename || item.name || 'Unknown file');
      let file = byFile.get(filename);
      if (!file) { file = { filename, lines: new Map() }; byFile.set(filename, file); }
      for (const line of list(item.lines?.line)) {
        const number = integer(line.number);
        if (number < 1 || number > 1000000) continue;
        file.lines.set(number, (file.lines.get(number) || 0) + integer(line.hits));
      }
    }
  }
  return [...byFile.values()].map(file => {
    const lines = [...file.lines.entries()].sort((a, b) => a[0] - b[0]);
    const covered = lines.filter(([, hits]) => hits > 0).length;
    return { filename: file.filename, sourceRoots, lines, covered, total: lines.length, missed: lines.length - covered,
      rate: lines.length ? covered / lines.length : null };
  }).sort((a, b) => (a.rate ?? 1) - (b.rate ?? 1) || b.missed - a.missed || a.filename.localeCompare(b.filename));
}

async function attachSource(file, sources, budget) {
  file.source = null;
  file.sourceNote = 'Source is not available. Executable line numbers are still shown.';
  if (!sources) return;
  const candidates = path.isAbsolute(file.filename) ? [file.filename] : [
    ...file.sourceRoots.map(root => path.resolve(/^[a-z]:$/i.test(root) ? `${root}${path.sep}` : root, file.filename)),
    path.resolve(sources, file.filename),
  ];
  const candidate = candidates.find(file => isInside(sources, file));
  if (!candidate) { file.sourceNote = 'This file is outside the configured source directory.'; return; }
  if (!isInside(sources, candidate)) { file.sourceNote = 'This file is outside the configured source directory.'; return; }
  try {
    // realpath also prevents symlink/junction source paths from reading outside the chosen root.
    const { realpath } = await import('node:fs/promises');
    if (!isInside(await realpath(sources), await realpath(candidate))) return;
    const info = await stat(candidate);
    if (info.size > 2 * 1024 * 1024 || info.size > budget.remaining) { file.sourceNote = 'Source omitted to keep the report compact (2 MB per file, 20 MB overall).'; return; }
    budget.remaining -= info.size;
    file.source = (await readFile(candidate, 'utf8')).replace(/^\uFEFF/, '').split(/\r?\n/);
    file.sourceNote = 'Source captured when this report was generated. Line numbers refer to the analyzed build; use matching source and PDB files.';
  } catch { /* source is optional; coverage data remains useful */ }
}

export async function generateReport({ output, mode, sources, startedAt }) {
  const xmlFile = path.join(output, mode === 'merge' ? 'merged.xml' : 'coverage.xml');
  if ((await stat(xmlFile)).size > 64 * 1024 * 1024) throw new Error('Coverage XML exceeds the 64 MB report limit.');
  const files = parseCoverage(await readFile(xmlFile, 'utf8'));
  const budget = { remaining: 20 * 1024 * 1024 };
  for (const file of files) await attachSource(file, sources, budget);
  const total = files.reduce((sum, file) => sum + file.total, 0);
  const covered = files.reduce((sum, file) => sum + file.covered, 0);
  const data = { version: '2.0.1', mode, generatedAt: new Date().toISOString(), startedAt, files, total, covered };
  const [template, css, script, tokens] = await Promise.all([
    readFile(path.join(directory, 'report/template.html'), 'utf8'),
    readFile(path.join(directory, 'report/style.css'), 'utf8'),
    readFile(path.join(directory, 'report/client.js'), 'utf8'),
    readFile(path.join(directory, '../resources/tokens.css'), 'utf8').catch(() => readFile(path.join(directory, '../node_modules/chatgpt-desktop-kit/dist/tokens.css'), 'utf8')),
  ]);
  // JSON lives in a non-executable script element. Escape '<' to make closing script tags inert.
  const json = JSON.stringify(data).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  const html = template.replace('/* REPORT_STYLE */', () => `${tokens}\n${css}`).replace('/* REPORT_SCRIPT */', () => script).replace('REPORT_DATA', () => json)
    .replace('REPORT_SUMMARY', () => escapeHtml(`${total ? (covered / total * 100).toFixed(1) : 'N/A'}${total ? '%' : ''} line coverage · ${files.length} files`));
  await mkdir(path.join(output, 'html'), { recursive: true });
  await writeFile(path.join(output, 'html', 'index.html'), html);
  return { total, covered, files: files.length };
}
