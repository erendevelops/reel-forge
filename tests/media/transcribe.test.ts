import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { transcribe } from '../../lib/media/transcribe';

let base: string;
let dir: string;
beforeAll(async () => {
  base = await fs.mkdtemp(path.join(os.tmpdir(), 'tbd-tr-'));
  dir = path.join(base, 'ğüş İ');
  await fs.mkdir(dir);
  await fs.copyFile(path.resolve('tests/fixtures/speech-en.wav'), path.join(dir, 'speech.wav'));
});
afterAll(async () => {
  await fs.rm(base, { recursive: true, force: true });
});

describe('transcribe', () => {
  it('transcribe returns ordered word times', { timeout: 300_000 }, async () => {
    const t = await transcribe(path.join(dir, 'speech.wav'), {
      lang: 'en',
      model: 'small',
      prompt: 'Fooocus, Whisper',
    });
    expect(t.words.length).toBeGreaterThanOrEqual(4);
    for (let i = 1; i < t.words.length; i++) {
      expect(t.words[i].start).toBeGreaterThanOrEqual(t.words[i - 1].start);
    }
    expect(t.words.some((x) => x.w.toLowerCase().includes('whisper'))).toBe(true);
    for (const x of t.words) expect(x.end).toBeGreaterThan(x.start);
  });
});
