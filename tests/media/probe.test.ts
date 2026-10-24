import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { run } from '../../lib/media/run';
import { probe } from '../../lib/media/probe';
import { makeClip } from '../helpers/media';

let dir: string;
beforeAll(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tbd-probe-'));
});
afterAll(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe('run', () => {
  it('run() handles unicode paths', async () => {
    const d = path.join(os.tmpdir(), 'ğüş İ Masaüstü');
    await fs.mkdir(d, { recursive: true });
    const f = path.join(d, 'x.txt');
    await fs.writeFile(f, 'merhaba-ğüş', 'utf8');
    const r = await run('node', ['-e', 'process.stdout.write(require("fs").readFileSync(process.argv[1],"utf8"))', f]);
    expect(r.stdout).toBe('merhaba-ğüş');
    expect(r.code).toBe(0);
    await fs.rm(d, { recursive: true, force: true });
  });
});

describe('probe', () => {
  it('probe reads basics', async () => {
    const f = await makeClip(dir, { w: 1080, h: 1920, fps: 60, seconds: 2, audio: true });
    const p = await probe(f);
    expect(p.fps).toBe(60);
    expect(p.width).toBe(1080);
    expect(p.height).toBe(1920);
    expect(p.hasAudio).toBe(true);
    expect(Math.abs(p.duration - 2)).toBeLessThan(0.05);
  });
  it('probe handles no audio', async () => {
    const f = await makeClip(dir, { w: 320, h: 240, fps: 30, seconds: 1 });
    const p = await probe(f);
    expect(p.hasAudio).toBe(false);
  });
  it('probe reports rotation', async () => {
    const f = await makeClip(dir, { w: 1920, h: 1080, fps: 30, seconds: 1, rotate: -90 });
    const p = await probe(f);
    expect(p.rotation).toBe(-90);
    expect(p.displayWidth).toBe(1080);
    expect(p.displayHeight).toBe(1920);
  });
  it('probe reports full range', async () => {
    const f = await makeClip(dir, { w: 320, h: 240, fps: 30, seconds: 1, fullRange: true });
    const p = await probe(f);
    expect(p.colorRange).toBe('pc');
  });
});
