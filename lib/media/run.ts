import { spawn, spawnSync } from 'node:child_process';

export interface RunOpts {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
}
export interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

export class RunError extends Error {
  constructor(
    public cmd: string,
    public code: number,
    public stderr: string,
  ) {
    super(`${cmd} failed with code ${code}: ${stderr.slice(-2000)}`);
    this.name = 'RunError';
  }
}

function killTree(pid: number | undefined, child: { kill: (s?: NodeJS.Signals) => boolean }): void {
  if (process.platform === 'win32' && pid) {
    spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true });
  } else {
    child.kill('SIGKILL');
  }
}

export function run(cmd: string, args: string[], opts: RunOpts = {}): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      shell: false,
      cwd: opts.cwd,
      env: opts.env ?? process.env,
      windowsHide: true,
    });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    let timedOut = false;
    let timer: NodeJS.Timeout | undefined;
    if (opts.timeoutMs) {
      timer = setTimeout(() => {
        timedOut = true;
        killTree(child.pid, child);
      }, opts.timeoutMs);
    }
    child.stdout.on('data', (d: Buffer) => out.push(d));
    child.stderr.on('data', (d: Buffer) => err.push(d));
    child.on('error', (e) => {
      if (timer) clearTimeout(timer);
      reject(new RunError(cmd, -1, String(e)));
    });
    child.on('close', (code) => {
      if (timer) clearTimeout(timer);
      const stdout = Buffer.concat(out).toString('utf8');
      const stderr = Buffer.concat(err).toString('utf8');
      if (timedOut) return reject(new RunError(cmd, code ?? -1, `timeout after ${opts.timeoutMs}ms\n${stderr}`));
      if (code !== 0) return reject(new RunError(cmd, code ?? -1, stderr));
      resolve({ code: 0, stdout, stderr });
    });
  });
}
