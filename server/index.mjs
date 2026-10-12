import { createApp } from './app.mjs';
import { spawn } from 'node:child_process';

const port = Number(process.env.PORT || 47831);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer from 1 to 65535.');
const app = await createApp({ development: process.argv.includes('--dev') });
app.server.on('error', error => { console.error(`Could not start CppCoverageTool: ${error.message}`); process.exitCode = 1; });
app.server.listen(port, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${port}`;
  console.log(`CppCoverageTool 2.0.0 — ${url}\nPress Ctrl+C to stop the local service.`);
  if (process.argv.includes('--open') && process.platform === 'win32') {
    const opener = spawn('explorer.exe', [url], { windowsHide: true, stdio: 'ignore' });
    opener.on('error', error => console.error(`Open ${url} manually: ${error.message}`));
    opener.unref();
  }
});
let closing = false;
async function shutdown() {
  if (closing) return;
  closing = true;
  try { await app.stop(); } catch (error) { console.error(error.message); }
  app.server.close();
  app.server.closeAllConnections();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
