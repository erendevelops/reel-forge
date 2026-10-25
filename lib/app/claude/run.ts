import { spawn } from 'node:child_process';
import { parseStreamLine, type ClaudeEvent } from './events';

export const DEFAULT_ALLOWED_TOOLS = ['Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep'];

const LIMIT = /session limit|usage limit|rate.?limit|\b429\b/i;
const AUTH = /login|log in|authenticate|auth|unauthori|oauth|session expired/i;

export function classifyFailure(stderr: string, stdout: string): { code: 'auth' | 'limit' | 'transport'; message: string; resetsAt?: string } {
  const message = stderr.trim() || stdout.trim() || 'Claude Code returned an unexpected error.';
  if (LIMIT.test(message)) {
    const resetsAt = /resets ([^·\n]+)/i.exec(message)?.[1]?.trim();
    return resetsAt ? { code: 'limit', message, resetsAt } : { code: 'limit', message };
  }
  return { code: AUTH.test(message) ? 'auth' : 'transport', message };
}

/**
 * On Windows the shell is cmd.exe and killing it leaves claude running; taskkill /T
 * takes the whole tree. Same approach as marketiyo.
 */
function killTree(pid: number | undefined, fallback: () => void): void {
  if (process.platform !== 'win32' || pid === undefined) return fallback();
  const killer = spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' });
  killer.on('error', fallback);
}

/**
 * `binary` is normally the claude command or its full path. A value "exe|script" runs
 * `exe script ...` without a shell; tests use it to drive a fake claude through node.
 */
function command(binary: string): { cmd: string; pre: string[]; shell: boolean } {
  if (binary.includes('|')) {
    const [cmd, ...pre] = binary.split('|');
    return { cmd, pre, shell: false };
  }
  // Windows needs the shell to find claude.cmd, and the shell splits unquoted paths on spaces.
  const win = process.platform === 'win32';
  const cmd = win && binary.includes(' ') && !binary.startsWith('"') ? `"${binary}"` : binary;
  return { cmd, pre: [], shell: win };
}

export type RunOptions = {
  binary: string;
  cwd: string;
  prompt: string;
  resumeSession?: string | null;
  allowedTools: string[];
  timeoutMs: number;
  onEvent: (e: ClaudeEvent) => void;
  signal?: AbortSignal;
};

/** Drives the installed Claude Code CLI as an agent, using the user's subscription login. */
export function runClaude(o: RunOptions): Promise<{ sessionId: string | null; ok: boolean }> {
  const { cmd, pre, shell } = command(o.binary);
  const args = [
    ...pre,
    '-p',
    '--output-format', 'stream-json',
    '--verbose',
    '--permission-mode', 'acceptEdits',
    '--allowedTools', o.allowedTools.join(','),
    ...(o.resumeSession ? ['--resume', o.resumeSession] : []),
  ];

  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: o.cwd, shell, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    let sessionId: string | null = o.resumeSession ?? null;
    let stdoutAll = '';
    let stderr = '';
    let buffer = '';
    let result: { ok: boolean; text: string } | null = null;
    let settled = false;

    const emit = (e: ClaudeEvent) => {
      if (e.kind === 'session') sessionId = e.sessionId;
      if (e.kind === 'result') result = e;
      o.onEvent(e);
    };
    const finish = (ok: boolean, error?: ClaudeEvent) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      o.signal?.removeEventListener('abort', onAbort);
      if (error) o.onEvent(error);
      resolve({ sessionId, ok });
    };
    const stop = (code: 'timeout' | 'transport', message: string) => {
      killTree(child.pid, () => child.kill());
      // An orphaned grandchild can hold the pipes open, so 'close' may never come.
      finish(false, { kind: 'error', code, message });
    };
    const onAbort = () => stop('transport', 'cancelled');
    o.signal?.addEventListener('abort', onAbort);
    const timer = setTimeout(() => stop('timeout', `no result after ${o.timeoutMs} ms`), o.timeoutMs);

    child.stdout.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8');
      stdoutAll += text;
      buffer += text;
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) parseStreamLine(line).forEach(emit);
    });
    child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString('utf8')));
    child.on('error', (err) => finish(false, { kind: 'error', code: 'transport', message: err.message }));
    child.on('close', (code) => {
      parseStreamLine(buffer).forEach(emit);
      const r = result as { ok: boolean; text: string } | null;
      if (r?.ok && code === 0) return finish(true);
      const f = classifyFailure(stderr, r?.text ?? stdoutAll);
      finish(false, { kind: 'error', ...f });
    });

    child.stdin.on('error', () => undefined);
    child.stdin.end(o.prompt);
  });
}
