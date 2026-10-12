(() => {
  'use strict';
  const data = JSON.parse(document.getElementById('report-data').textContent);
  const $ = id => document.getElementById(id);
  const percent = value => value === null ? 'N/A' : `${(value * 100).toFixed(1)}%`;
  const number = value => value.toLocaleString('en-US');
  let selected = null;
  let currentMissed = -1;
  let trigger = null;
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.classList.toggle('dark', systemDark);
  $('theme').onclick = () => document.documentElement.classList.toggle('dark');
  $('print').onclick = () => window.print();
  $('total-rate').textContent = percent(data.total ? data.covered / data.total : null);
  $('overall-bar').style.width = `${data.total ? data.covered / data.total * 100 : 0}%`;
  $('covered').textContent = number(data.covered);
  $('missed').textContent = number(data.total - data.covered);
  $('file-count').textContent = number(data.files.length);
  $('generated').textContent = `${data.mode === 'merge' ? 'Merged coverage' : 'Coverage analysis'} · ${new Date(data.generatedAt).toLocaleString('en-US')}`;
  function node(tag, text, className) {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
  }
  function renderFiles() {
    const query = $('search').value.toLowerCase();
    const filter = $('filter').value;
    const files = data.files.filter(file => file.filename.toLowerCase().includes(query) &&
      (filter === 'all' || filter === 'gaps' && file.missed > 0 || filter === 'zero' && file.covered === 0 && file.total > 0 || filter === 'complete' && file.total > 0 && file.missed === 0));
    const sort = $('sort').value;
    files.sort(sort === 'name' ? (a, b) => a.filename.localeCompare(b.filename) : sort === 'missed' ? (a, b) => b.missed - a.missed || a.filename.localeCompare(b.filename) : (a, b) => (a.rate ?? 1) - (b.rate ?? 1) || b.missed - a.missed);
    const fragment = document.createDocumentFragment();
    files.forEach(file => {
      const row = node('tr');
      const nameCell = node('td');
      const name = file.filename.split(/[\\/]/).pop();
      const button = node('button', name, 'file-link'); button.type = 'button'; button.setAttribute('aria-label', `Inspect ${file.filename}`);
      button.onclick = () => showSource(file, button);
      nameCell.append(button, node('span', file.filename, 'file-path'));
      const rate = node('td', percent(file.rate), `rate-cell${file.rate === 0 ? ' zero' : ''}`);
      const bar = node('div', undefined, 'coverage-bar'); const fill = node('span'); fill.style.width = `${(file.rate ?? 0) * 100}%`; bar.append(fill); rate.append(bar);
      row.append(nameCell, rate, node('td', `${number(file.covered)} / ${number(file.total)}`), node('td', number(file.missed)));
      fragment.append(row);
    });
    $('files').replaceChildren(fragment); $('visible-count').textContent = `${files.length} of ${data.files.length} files`; $('empty').hidden = files.length > 0;
  }
  function renderSource() {
    const lineHits = new Map(selected.lines);
    const onlyMissed = $('missed-only').checked;
    const fragment = document.createDocumentFragment();
    const count = selected.source ? Math.max(selected.source.length, selected.lines.at(-1)?.[0] || 0) : 0;
    const lineNumbers = selected.source ? Array.from({ length: count }, (_, index) => index + 1) : selected.lines.map(([line]) => line);
    lineNumbers.forEach(line => {
      const hits = lineHits.get(line);
      if (onlyMissed && hits !== 0) return;
      const row = node('div', undefined, `source-line ${hits === undefined ? '' : hits > 0 ? 'hit' : 'missed'}`); row.dataset.line = String(line);
      row.append(node('span', String(line), 'line-number'), node('span', hits === undefined ? '—' : `${hits}×`, 'line-hits'), node('span', selected.source?.[line - 1] ?? '[source unavailable]', 'line-code'));
      fragment.append(row);
    });
    $('source-lines').replaceChildren(fragment); $('source-lines').scrollTop = 0; currentMissed = -1;
  }
  function showSource(file, button) {
    selected = file; trigger = button;
    $('source-title').textContent = file.filename;
    $('source-summary').textContent = `${percent(file.rate)} line coverage · ${file.covered} / ${file.total} executable lines · ${file.missed} uncovered`;
    $('source-note').textContent = file.sourceNote;
    $('missed-only').checked = false; $('next-missed').disabled = file.missed === 0;
    renderSource(); $('source-dialog').showModal(); $('close').focus();
  }
  $('close').onclick = () => $('source-dialog').close();
  $('source-dialog').addEventListener('close', () => trigger?.focus());
  $('missed-only').onchange = renderSource;
  $('next-missed').onclick = () => {
    const rows = [...$('source-lines').querySelectorAll('.missed')];
    if (!rows.length) return;
    $('source-lines').querySelector('.current')?.classList.remove('current');
    currentMissed = (currentMissed + 1) % rows.length;
    rows[currentMissed].classList.add('current'); rows[currentMissed].scrollIntoView({ block: 'center' });
  };
  $('search').oninput = renderFiles; $('filter').onchange = renderFiles; $('sort').onchange = renderFiles;
  renderFiles();
})();
