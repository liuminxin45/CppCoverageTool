import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Button, Input, Textarea, Checkbox, Select, Tabs, Dialog, InlineNotice,
  InternalScrollArea, PageHeader, PageBar, MetadataList, DesktopProvider,
  DesktopDocumentAdapter, SaveIcon, FolderSimple, Toaster, toast,
} from 'chatgpt-desktop-kit';
import 'chatgpt-desktop-kit/desktop.css';
import './style.css';

interface Settings {
  target: string; sources: string; output: string; merge: string; pdb: string;
  modules: string; excluded: string; targetArguments: string; extraArguments: string;
  coverChildren: boolean; optimized: boolean;
}
interface Job {
  id: string; mode: 'coverage' | 'merge'; status: string; log: string; output: string;
  exitCode: number | null; inputCount: number | null; startedAt: string; finishedAt: string | null;
}
interface State { version: string; settings: Settings; settingsError: string | null; program: string | null; job: Job | null }
async function api<T>(endpoint: string, value?: unknown): Promise<T> {
  const result = await fetch(`/api/${endpoint}`, value === undefined ? undefined : {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Coverage-Client': '1' }, body: JSON.stringify(value),
  });
  const data = await result.json();
  if (!result.ok) throw new Error(data.error || 'The local service could not complete this request.');
  return data;
}

function App() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saved, setSaved] = useState('');
  const [state, setState] = useState<State | null>(null);
  const [tab, setTab] = useState('coverage');
  const [about, setAbout] = useState(false);
  const [pending, setPending] = useState(false);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState('');
  const [connectionError, setConnectionError] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => {
    try { const value = localStorage.getItem('coverage-theme'); return value === 'light' || value === 'dark' ? value : 'system'; } catch { return 'system'; }
  });
  const logRef = useRef<HTMLPreElement>(null);
  const aboutTrigger = useRef<HTMLButtonElement>(null);
  const followLog = useRef(true);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const dirty = settings !== null && JSON.stringify(settings) !== saved;
  const job = state?.job;
  const running = !!job && ['running', 'stopping', 'generating'].includes(job.status);
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => document.documentElement.classList.toggle('dark', theme === 'dark' || theme === 'system' && media.matches);
    apply(); media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);
  function closeAbout() {
    setAbout(false);
    // This controlled Dialog has no Radix Trigger; the host restores its actual command after portal cleanup.
    requestAnimationFrame(() => requestAnimationFrame(() => aboutTrigger.current?.focus()));
  }
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      try {
        const next = await api<State>('state');
        if (!active) return;
        setState(next); setConnectionError('');
        if (!settingsRef.current) { settingsRef.current = next.settings; setSettings(next.settings); setSaved(JSON.stringify(next.settings)); }
      } catch (error) { if (active) setConnectionError((error as Error).message); }
      if (active) timer = setTimeout(refresh, 1000);
    }
    void refresh();
    return () => { active = false; clearTimeout(timer); };
  }, []);
  useEffect(() => {
    if (!dirty && !running) return;
    const prevent = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', prevent);
    return () => window.removeEventListener('beforeunload', prevent);
  }, [dirty, running]);
  useEffect(() => {
    if (followLog.current && logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [job?.log]);
  function update<K extends keyof Settings>(key: K, value: Settings[K]) { setSettings(current => current ? { ...current, [key]: value } : current); }
  async function action(fn: () => Promise<void>) {
    setPending(true); setError('');
    try { await fn(); } catch (error) { setError((error as Error).message); }
    finally { setPending(false); }
  }
  async function pick(key: 'target' | 'sources' | 'output' | 'merge') {
    setPicking(true); setError('');
    try { const result = await api<{ path: string }>('pick', { kind: key === 'target' ? 'file' : 'folder' }); if (result.path) update(key, result.path); }
    catch (error) { setError((error as Error).message); }
    finally { setPicking(false); }
  }
  function pathField(key: 'target' | 'sources' | 'output' | 'merge', label: string, hint: string) {
    return <div className="field"><label htmlFor={key}>{label}</label><div className="path-row">
      <Input id={key} value={settings?.[key] || ''} onChange={event => update(key, event.target.value)} placeholder={hint} disabled={pending || running} />
      <Button size="sm" icon={<FolderSimple />} disabled={picking || pending || running} onClick={() => void pick(key)}>Browse</Button>
    </div></div>;
  }
  async function run() {
    if (!settings) return;
    await action(async () => {
      const next = await api<{ job: Job }>(tab === 'merge' ? 'merge' : 'run', settings);
      setState(current => current ? { ...current, job: next.job } : current);
      setSaved(JSON.stringify(settings)); followLog.current = true;
    });
  }
  return <DesktopDocumentAdapter><DesktopProvider theme={theme} className="app-root">
    <div className="app">
      <header className="app-heading"><div className="brand"><img src="/icon.png" alt="" /><span>CppCoverageTool <span className="version">2.0</span></span></div>
        <div className="heading-actions"><Select size="sm" aria-label="Appearance" value={theme} options={[{ value: 'system', label: 'System theme' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} onValueChange={value => { const next = value as typeof theme; setTheme(next); try { localStorage.setItem('coverage-theme', next); } catch { /* theme remains usable */ } }} />
          <Button ref={aboutTrigger} size="sm" variant="ghost" onClick={() => setAbout(true)}>About</Button></div>
      </header>
      <PageBar ariaLabel="Coverage workspace" navigation={<Tabs ariaLabel="Workflows" value={tab} items={[{ value: 'coverage', label: 'Run coverage', tabId: 'coverage-tab', panelId: 'workflow-panel' }, { value: 'merge', label: 'Merge reports', tabId: 'merge-tab', panelId: 'workflow-panel' }]} onValueChange={setTab} />}
        status={<span>{running ? `${job?.status === 'generating' ? 'Generating report' : job?.status === 'stopping' ? 'Stopping' : 'Running'}…` : dirty ? 'Unsaved changes' : 'Settings saved'}</span>}
        actions={<Button size="sm" icon={<SaveIcon />} disabled={!settings || pending || !dirty || running} onClick={() => void action(async () => { await api('settings', settings); setSaved(JSON.stringify(settings)); toast.success('Settings saved'); })}>Save settings</Button>} />
      <InternalScrollArea className="workspace-scroll">
        <main className="workspace">
          {connectionError && <InlineNotice tone="danger" title="Local service unavailable" description={`${connectionError} Keep this page open and restart the service to reconnect.`} />}
          {error && <InlineNotice tone="danger" title="Could not complete the action" description={error} actions={<Button size="sm" onClick={() => setError('')}>Dismiss</Button>} />}
          {state?.settingsError && <InlineNotice tone="warning" title="Settings recovery" description={state.settingsError} />}
          <div className="engine"><div><span className="eyebrow">COVERAGE ENGINE</span><p>{state ? state.program ? 'OpenCppCoverage is ready' : 'OpenCppCoverage is not installed' : 'Connecting to the local service…'}</p><span className="supporting engine-path">{state?.program || 'Install OpenCppCoverage and add it to PATH.'}</span></div>
            {state && !state.program && <a href="https://github.com/OpenCppCoverage/OpenCppCoverage/releases" target="_blank" rel="noreferrer">Download OpenCppCoverage ↗</a>}</div>
          <div className="workspace-columns">
            <section id="workflow-panel" role="tabpanel" aria-labelledby={`${tab}-tab`} className="workflow">
              <PageHeader title={tab === 'coverage' ? 'Measure your C++ code' : 'Bring your runs together'} description={tab === 'coverage' ? 'Run an executable and turn its coverage into a report you can explore.' : 'Combine binary coverage files into one report. Generated results are excluded automatically.'} />
              {!settings ? <p>Loading configuration…</p> : <form onSubmit={event => { event.preventDefault(); void run(); }}>
                {tab === 'coverage' ? <>
                  {pathField('target', 'Target executable', 'C:\\project\\build\\app.exe')}
                  <p className="supporting working-dir">Working directory: {settings.target ? settings.target.replace(/[\\/][^\\/]*$/, '') : 'inferred from the executable'}</p>
                  {pathField('sources', 'Source directory', 'C:\\project\\src')}
                </> : <>{pathField('merge', 'Directory containing COV files', 'C:\\coverage\\inputs')}{pathField('sources', 'Source directory (optional)', 'Include a source snapshot in the report')}</>}
                {pathField('output', 'Report directory', 'C:\\coverage\\output')}
                <p className="supporting">Each run creates a separate folder with an HTML report, COV data and Cobertura XML.</p>
                <div hidden={tab !== 'coverage'}>
                  <details className="advanced"><summary>Filters and advanced options</summary><div className="advanced-fields">
                    <div className="field"><label htmlFor="modules">Module filters <span className="supporting">one per line</span></label><Textarea id="modules" autoSize value={settings.modules} disabled={running || pending} placeholder="Defaults to the target executable. Add DLL names to include libraries." onChange={e => update('modules', e.target.value)} /></div>
                    <div className="field"><label htmlFor="excluded">Excluded source paths <span className="supporting">one per line</span></label><Textarea id="excluded" autoSize value={settings.excluded} disabled={running || pending} placeholder="*\\third_party\\*" onChange={e => update('excluded', e.target.value)} /></div>
                    <div className="field"><label htmlFor="pdb">Original PDB source prefix</label><Input id="pdb" value={settings.pdb} disabled={running || pending} onChange={e => update('pdb', e.target.value)} /><p className="supporting">Maps this build-time prefix to the source directory above.</p></div>
                    <div className="field"><label htmlFor="targetArguments">Target arguments</label><Textarea id="targetArguments" autoSize value={settings.targetArguments} disabled={running || pending} onChange={e => update('targetArguments', e.target.value)} /><p className="supporting">JSON string array, for example ["--test", "a path with spaces"].</p></div>
                    <div className="field"><label htmlFor="extraArguments">Additional coverage filters</label><Textarea id="extraArguments" autoSize value={settings.extraArguments} disabled={running || pending} onChange={e => update('extraArguments', e.target.value)} /><p className="supporting">JSON array. Supports --excluded_modules, --excluded_line_regex, --continue_after_cpp_exception and --no_aggregate_by_file.</p></div>
                    <div className="options"><label><Checkbox checked={settings.coverChildren} disabled={running || pending} onChange={e => update('coverChildren', e.target.checked)} />Cover child processes</label><label><Checkbox checked={settings.optimized} disabled={running || pending} onChange={e => update('optimized', e.target.checked)} />Optimized build heuristics</label></div>
                  </div></details>
                </div>
                <div className="run-actions"><Button type="submit" variant="primary" disabled={picking || pending || running || !state?.program || !!connectionError}>{pending ? 'Starting…' : tab === 'coverage' ? 'Run coverage' : 'Merge reports'}</Button><span className="supporting">Settings are saved when you run.</span></div>
              </form>}
            </section>
            <section className="execution" aria-label="Execution results">
              <div className="section-heading"><h2>Latest run</h2>{job && <span role="status" className={`run-status status-${job.status}`}>{job.status}</span>}</div>
              {!job ? <div className="empty-run"><span className="eyebrow">READY WHEN YOU ARE</span><h3>Your report starts here</h3><p className="supporting">Choose your paths and run coverage. Progress and the finished report will appear here.</p><div className="report-formats"><span>HTML report</span><span>COV</span><span>Cobertura XML</span></div></div> : <>
                <MetadataList><dt>Workflow</dt><dd>{job.mode === 'merge' ? `Merge · ${job.inputCount} files` : 'Coverage analysis'}</dd><dt>Started</dt><dd>{new Date(job.startedAt).toLocaleString('en-US')}</dd><dt>Report folder</dt><dd className="output-path">{job.output}</dd>{job.exitCode !== null && <><dt>Exit code</dt><dd>{job.exitCode}</dd></>}</MetadataList>
                <div className="result-actions">{running ? <Button variant="danger" size="sm" disabled={pending || job.status !== 'running'} onClick={() => void action(async () => { const next = await api<{ job: Job }>('stop', {}); setState(current => current ? { ...current, job: next.job } : current); })}>{job.status === 'stopping' ? 'Stopping…' : 'Stop run'}</Button> : <><Button size="sm" disabled={pending || job.status !== 'completed'} onClick={() => void action(async () => { await api('open-report', {}); })}>Open report</Button><Button size="sm" variant="ghost" disabled={pending} onClick={() => void action(async () => { await api('open-output', {}); })}>Open folder</Button></>}</div>
              </>}
              <div className="section-heading log-heading"><h2>Execution log</h2>{job && <Button variant="ghost" size="sm" onClick={() => void action(async () => { await navigator.clipboard.writeText(job.log); toast.success('Log copied'); })}>Copy log</Button>}</div>
              <pre ref={logRef} className="execution-log" tabIndex={0} aria-label="Execution log" onScroll={e => { const element = e.currentTarget; followLog.current = element.scrollHeight - element.scrollTop - element.clientHeight < 40; }}>{job?.log || 'No process has been started.'}</pre>
              {job && <p className="supporting">Showing the latest 256 KB. Scroll up to pause automatic following.</p>}
            </section>
          </div>
          <footer className="workspace-footer">Local execution · Your source code stays on this computer</footer>
        </main>
      </InternalScrollArea>
      <Dialog open={about} title="About CppCoverageTool" description="Version 2.0.1" onClose={closeAbout} footer={<Button onClick={closeAbout}>Close</Button>}>
        <div className="about-copy"><p>A local web workspace for Windows C++ code coverage, powered by OpenCppCoverage.</p><p>Configure a run, merge COV files and explore readable HTML reports with line-by-line coverage. Analysis runs on your computer; the interface does not upload your code or reports.</p><p>Built with React and the ChatGPT Desktop UI component library. OpenCppCoverage is installed separately.</p><p><a href="https://github.com/liuminxin45/CppCoverageTool" target="_blank" rel="noreferrer">Source code and documentation ↗</a></p><p>Released under the MIT License.</p></div>
      </Dialog><Toaster />
    </div>
  </DesktopProvider></DesktopDocumentAdapter>;
}

createRoot(document.getElementById('root')!).render(<App />);
