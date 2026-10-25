import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { run, RunError } from './run';
import { repoPath } from '../root';

export interface Transcript {
  language: string;
  words: { w: string; start: number; end: number }[];
}

const SCRIPT = repoPath('tools', 'transcribe.py');

export async function transcribe(
  audio: string,
  o: { lang: string; model?: string; prompt?: string },
): Promise<Transcript> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tbd-whisper-'));
  const out = path.join(dir, 'out.json');
  const args = [SCRIPT, audio, out, '--lang', o.lang, '--model', o.model ?? 'medium'];
  if (o.prompt) args.push('--prompt', o.prompt);
  const env = { ...process.env, PYTHONIOENCODING: 'utf-8' };
  try {
    try {
      await run('python', args, { env });
    } catch (e) {
      // Only fall back when python itself could not be launched.
      if (e instanceof RunError && e.code === -1) await run('python3', args, { env });
      else throw e;
    }
    return JSON.parse(await fs.readFile(out, 'utf8')) as Transcript;
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}
