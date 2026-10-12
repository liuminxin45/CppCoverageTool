import path from 'node:path';
import { stat, readdir, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import os from 'node:os';

export function defaults() {
  return { target: '', sources: '', output: path.join(os.homedir(), 'Documents', 'CppCoverageTool', 'output'),
    merge: '', pdb: '', modules: '', excluded: '', targetArguments: '[]', extraArguments: '[]',
    coverChildren: true, optimized: true };
}

export function normalizeSettings(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Settings must be an object.');
  const result = defaults();
  for (const [key, fallback] of Object.entries(result)) {
    const item = value[key] ?? fallback;
    if (typeof item !== typeof fallback || (typeof item === 'string' && (item.length > 32768 || item.includes('\0')))) {
      throw new Error(`Invalid setting: ${key}.`);
    }
    result[key] = typeof item === 'string' ? item.trim() : item;
    if (process.platform === 'win32' && ['target', 'sources', 'output', 'merge', 'pdb', 'modules', 'excluded'].includes(key)) {
      result[key] = result[key].replace(/\//g, '\\');
    }
  }
  return result;
}

export function argumentArray(text, label) {
  let value;
  try { value = JSON.parse(text || '[]'); } catch { throw new Error(`${label} must be a JSON array of strings.`); }
  if (!Array.isArray(value) || value.length > 200 || value.some(v => typeof v !== 'string' || v.includes('\0') || v.length > 8192)) {
    throw new Error(`${label} must be a JSON array of strings (up to 200 arguments).`);
  }
  return value;
}

const lines = text => [...new Set(text.split(/\r?\n/).map(v => v.trim()).filter(Boolean))];
export function coverageArguments(settings, output) {
  const args = [];
  for (const module of lines(settings.modules || path.basename(settings.target))) args.push('--modules', module);
  args.push('--sources', settings.sources, '--working_dir', path.dirname(settings.target));
  if (settings.pdb) {
    if (settings.pdb.includes('?') || settings.sources.includes('?')) throw new Error('PDB substitution paths cannot contain a question mark.');
    args.push('--substitute_pdb_source_path', `${settings.pdb}?${settings.sources}`);
  }
  for (const excluded of lines(settings.excluded)) args.push('--excluded_sources', excluded);
  args.push(...exportArguments(output, 'coverage'), '--verbose');
  if (settings.coverChildren) args.push('--cover_children');
  if (settings.optimized) args.push('--optimized_build');
  const extra = argumentArray(settings.extraArguments, 'Coverage arguments');
  // Keep execution and output ownership in the application. Advanced flags may only refine filtering.
  const allowed = new Set(['--excluded_modules', '--excluded_line_regex', '--continue_after_cpp_exception', '--no_aggregate_by_file']);
  const requiresValue = new Set(['--excluded_modules', '--excluded_line_regex']);
  for (let i = 0; i < extra.length; i++) {
    const [flag, ...inline] = extra[i].split('=');
    if (!allowed.has(flag)) throw new Error(`Unsupported advanced option: ${flag}.`);
    if (requiresValue.has(flag)) {
      if (!inline.length && (i + 1 === extra.length || extra[i + 1].startsWith('--'))) throw new Error(`${flag} requires a value.`);
      if (!inline.length) i++;
    } else if (inline.length) throw new Error(`${flag} does not accept a value.`);
  }
  return [...args, ...extra, '--', settings.target, ...argumentArray(settings.targetArguments, 'Target arguments')];
}

function exportArguments(output, name) {
  return [`--export_type=binary:${path.join(output, `${name}.cov`)}`,
    `--export_type=cobertura:${path.join(output, `${name}.xml`)}`];
}
export function mergeArguments(files, output) {
  return [...files.map(file => `--input_coverage=${file}`), ...exportArguments(output, 'merged')];
}

export function isInside(parent, child) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

export async function requirePath(value, kind, label) {
  if (!value || !path.isAbsolute(value)) throw new Error(`${label} must be an absolute local path.`);
  const info = await stat(value).catch(() => null);
  if (!info || (kind === 'file' ? !info.isFile() : !info.isDirectory())) throw new Error(`${label} does not exist or is not a ${kind}.`);
}

export async function findCoverageFiles(directory, output) {
  if (isInside(output, directory)) throw new Error('The COV input directory must be outside the output directory.');
  const files = [];
  async function walk(folder) {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      const full = path.join(folder, entry.name);
      if (isInside(output, full) || entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile() && /\.cov$/i.test(entry.name)) files.push(full);
      if (files.length > 1000) throw new Error('Too many COV files. Select a smaller input directory (maximum 1,000 files).');
    }
  }
  await walk(directory);
  return files.sort();
}

export async function detectCoverage(env = process.env) {
  const locations = (env.PATH || '').split(path.delimiter).map(dir => path.join(dir.replace(/^"|"$/g, ''), 'OpenCppCoverage.exe'));
  if (env.ProgramFiles) locations.push(path.join(env.ProgramFiles, 'OpenCppCoverage', 'OpenCppCoverage.exe'));
  for (const candidate of locations) {
    try { await access(candidate, constants.F_OK); if ((await stat(candidate)).isFile()) return candidate; } catch { /* next candidate */ }
  }
  return null;
}
