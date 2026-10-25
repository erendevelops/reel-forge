import { spawn } from 'node:child_process';
import os from 'node:os';
import { t, type Language } from '@/lib/i18n';
import { runClaude } from './run';

export type Availability = { status: 'ok' | 'missing' | 'logged-out' | 'no-response'; detail: string };

function version(binary: string): Promise<string | null> {
  const [cmd, ...pre] = binary.includes('|') ? binary.split('|') : [binary];
  const shell = !binary.includes('|') && process.platform === 'win32';
  return new Promise((resolve) => {
    const child = spawn(shell && cmd.includes(' ') ? `"${cmd}"` : cmd, [...pre, '--version'], { shell, windowsHide: true });
    let out = '';
    const timer = setTimeout(() => (child.kill(), resolve(null)), 15_000);
    child.stdout.on('data', (c: Buffer) => (out += c.toString('utf8')));
    child.on('error', () => (clearTimeout(timer), resolve(null)));
    child.on('close', (code) => (clearTimeout(timer), resolve(code === 0 ? out.trim() : null)));
  });
}

/**
 * `--version` succeeds without a login, so it only proves the binary exists; the login is
 * proven by a tiny real prompt (costs a few tokens of the user's plan).
 */
export async function checkAvailability(binary: string, lang: Language): Promise<Availability> {
  const d = t(lang).claude;
  const v = await version(binary);
  if (!v) return { status: 'missing', detail: d.missing };
  let error: { code: string; message: string } | null = null;
  const res = await runClaude({
    binary,
    cwd: os.tmpdir(),
    prompt: 'Reply with the single word ok.',
    allowedTools: [],
    timeoutMs: 60_000,
    onEvent: (e) => {
      if (e.kind === 'error') error = e;
    },
  });
  if (res.ok) return { status: 'ok', detail: `${v}, ${d.ok}` };
  const e = error as { code: string; message: string } | null;
  if (e?.code === 'auth') return { status: 'logged-out', detail: d.loggedOut };
  if (e?.code === 'timeout') return { status: 'no-response', detail: d.noResponse };
  return { status: 'no-response', detail: `${v}: ${e?.message ?? d.noResponse}` };
}
