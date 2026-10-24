import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { run } from '../../lib/media/run';
import { probe } from '../../lib/media/probe';
import { makeClip } from '../helpers/media';
import { prepareClip, finishLoudness, lumaStats } from '../../lib/media/prepare';

let dir: string;
beforeAll(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'prep-'));
});
afterAll(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

const opts = { from: 0.5, duration: 2, width: 1080, height: 1920, fps: 60 as const };

describe('prepareClip', () => {
  it('writes BT.709 TV range', async () => {
    const src = await makeClip(dir, { w: 1920, h: 1080, fps: 30, seconds: 4, audio: true });
    const out = path.join(dir, 'a.mp4');
    await prepareClip(src, out, opts);
    const p = await probe(out);
    expect(p.colorRange).toBe('tv');
    expect(p.colorSpace).toBe('bt709');
    expect(p.fps).toBe(60);
    expect(p.width).toBe(1080);
    expect(p.height).toBe(1920);
    expect(p.hasAudio).toBe(false);
  });

  it('rotates by side-data', async () => {
    const src = await makeClip(dir, { w: 1920, h: 1080, fps: 30, seconds: 3, rotate: 90 });
    const out = path.join(dir, 'r.mp4');
    await prepareClip(src, out, { ...opts, from: 0, duration: 1 });
    const p = await probe(out);
    expect([p.width, p.height]).toEqual([1080, 1920]);
  });

  it('normalises full range', async () => {
    const src = await makeClip(dir, { w: 1280, h: 720, fps: 30, seconds: 3, fullRange: true });
    const out = path.join(dir, 'f.mp4');
    await prepareClip(src, out, { from: 0, duration: 1, width: 1280, height: 720, fps: 30 });
    const p = await probe(out);
    expect(p.colorRange).toBe('tv');
    const a = await lumaStats(src, 0.5, 320, 180);
    const b = await lumaStats(out, 0.5, 320, 180);
    expect(Math.abs(a.yavg - b.yavg)).toBeLessThanOrEqual(3);
  });

  it('upsamples 30fps', async () => {
    const src = await makeClip(dir, { w: 1920, h: 1080, fps: 30, seconds: 4 });
    const out = path.join(dir, 'u.mp4');
    await prepareClip(src, out, opts);
    const p = await probe(out);
    expect(p.fps).toBe(60);
    expect(Math.abs(p.duration - (opts.duration + 0.3))).toBeLessThanOrEqual(0.05);
  });
});

describe('finishLoudness', () => {
  it('hits target', async () => {
    const src = path.join(dir, 'quiet.mp4');
    await run('ffmpeg', [
      '-y', '-v', 'error',
      '-f', 'lavfi', '-i', 'testsrc2=size=320x240:rate=30:duration=8',
      '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=8',
      '-af', 'volume=-30dB', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-shortest', src,
    ]);
    const out = path.join(dir, 'loud.mp4');
    await finishLoudness(src, out, { I: -14, TP: -1.5 });
    const { stderr } = await run('ffmpeg', ['-nostats', '-i', out, '-af', 'ebur128=peak=true', '-f', 'null', '-']);
    const summary = stderr.slice(stderr.lastIndexOf('Summary:'));
    const I = Number(/I:\s+(-?[\d.]+) LUFS/.exec(summary)![1]);
    const peak = Number(/Peak:\s+(-?[\d.]+) dBFS/.exec(summary)![1]);
    expect(Math.abs(I - -14)).toBeLessThanOrEqual(1);
    expect(peak).toBeLessThanOrEqual(-1.5);
  });
});
