import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { run } from '../../lib/media/run';
import { probe } from '../../lib/media/probe';
import { makeClip } from '../helpers/media';
import { prepareClip, finishLoudness, lumaStats, cropCommands, measureLoudness } from '../../lib/media/prepare';
import { cropPath } from '../../lib/talking/reframe';

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
    expect(p.colorPrimaries).toBe('bt709');
    expect(p.colorTransfer).toBe('bt709');
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

  it('prepareClip applies crop path', async () => {
    const src = await makeClip(dir, { w: 1920, h: 1080, fps: 30, seconds: 3 });
    const out = path.join(dir, 'c.mp4');
    const crop = [
      { t: 0, x: 200, y: 0, w: 608, h: 1080 },
      { t: 0.5, x: 230, y: 0, w: 608, h: 1080 },
      { t: 1.0, x: 260, y: 0, w: 608, h: 1080 },
    ];
    await prepareClip(src, out, { from: 0, duration: 1.5, width: 1080, height: 1920, fps: 30, crop });
    const p = await probe(out);
    expect([p.width, p.height]).toEqual([1080, 1920]);
    expect(p.colorSpace).toBe('bt709');
    expect(p.colorRange).toBe('tv');
  });

  it('crop path moves the window over time', async () => {
    // left half white, right half black: a window at x=0 is white, one at the right edge is black
    const src = path.join(dir, 'halves.mp4');
    await run('ffmpeg', [
      '-y', '-v', 'error',
      '-f', 'lavfi', '-i', 'color=c=white:s=960x1080:r=30:d=3',
      '-f', 'lavfi', '-i', 'color=c=black:s=960x1080:r=30:d=3',
      '-filter_complex', '[0:v][1:v]hstack,format=yuv420p', '-c:v', 'libx264', '-preset', 'ultrafast', src,
    ]);
    const out = path.join(dir, 'cm.mp4');
    const crop = [
      { t: 0, x: 0, y: 0, w: 608, h: 1080 },
      { t: 1.0, x: 1312, y: 0, w: 608, h: 1080 },
    ];
    await prepareClip(src, out, { from: 0, duration: 2, width: 270, height: 480, fps: 30, crop });
    expect((await lumaStats(out, 0.05, 54, 96)).yavg).toBeGreaterThan(200);
    expect((await lumaStats(out, 1.5, 54, 96)).yavg).toBeLessThan(40);
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

describe('cropCommands', () => {
  it('interpolates the crop per frame: no frame step exceeds its share of the per-sample limit', () => {
    // a face drifting at the full 2%/sample rate limit, sampled at 10 Hz
    const boxes = Array.from({ length: 31 }, (_, i) => ({ t: i / 10, x: 0.1 + i * 0.03, y: 0.3, bw: 0.1, bh: 0.2 }));
    const crop = cropPath({ w: 1920, h: 1080, boxes }, { w: 1920, h: 1080 }, '9:16');
    const fps = 60;
    const { steps, script } = cropCommands(crop, 0.5, 2, fps);
    expect(steps).toHaveLength(2 * fps + 1);
    const perSample = Math.max(...crop.slice(1).map((c, i) => Math.abs(c.x - crop[i].x)));
    expect(perSample).toBeGreaterThan(0);
    const share = perSample * (1 / fps) / 0.1; // one frame's share of one 0.1 s sample step
    for (let k = 1; k < steps.length; k++) {
      expect(Math.abs(steps[k].x - steps[k - 1].x)).toBeLessThanOrEqual(Math.ceil(share) + 1);
    }
    // many small commands, not one jump per sample
    expect(script.trim().split(/\r?\n/).length).toBeGreaterThan(2 * 10 * 2);
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

  it('two-pass: true peak lands <= -1.5 dBTP after AAC on a signal single-pass overshot', async () => {
    // brown noise (seed 3): the old single-pass loudnorm + AAC 320k gave I -14.10, TP -1.38 dBTP (over the gate)
    const src = path.join(dir, 'brown.mkv');
    await run('ffmpeg', [
      '-y', '-v', 'error',
      '-f', 'lavfi', '-i', 'testsrc2=size=320x240:rate=30:duration=8',
      '-f', 'lavfi', '-i', 'anoisesrc=color=brown:amplitude=0.9:d=8:r=48000:seed=3',
      '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'pcm_s16le', '-shortest', src,
    ]);
    const single = path.join(dir, 'brown-single.mp4');
    await run('ffmpeg', ['-y', '-v', 'error', '-i', src, '-c:v', 'copy', '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11', '-ar', '48000', '-c:a', 'aac', '-b:a', '320k', single]);
    expect((await measureLoudness(single, { I: -14, TP: -1.5 })).TP).toBeGreaterThan(-1.5); // the regression this guards

    const out = path.join(dir, 'brown-two-pass.mp4');
    await finishLoudness(src, out, { I: -14, TP: -1.5 });
    const m = await measureLoudness(out, { I: -14, TP: -1.5 });
    expect(m.TP).toBeLessThanOrEqual(-1.5);
    expect(Math.abs(m.I - -14)).toBeLessThanOrEqual(1);
    // still -t bounded and video stream-copied
    const v = (f: string) => run('ffprobe', ['-v', 'error', '-count_packets', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name,nb_read_packets', '-of', 'csv=p=0', f]);
    expect((await v(out)).stdout.trim()).toBe((await v(src)).stdout.trim());
    const p = await probe(out);
    expect(Math.abs(p.duration - 8)).toBeLessThanOrEqual(1 / 30 + 1e-6);
  });

  it('two-pass falls back cleanly on silent audio (loudnorm measures -inf)', async () => {
    const src = path.join(dir, 'silent.mkv');
    await run('ffmpeg', [
      '-y', '-v', 'error',
      '-f', 'lavfi', '-i', 'testsrc2=size=320x240:rate=30:duration=2',
      '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo:d=2',
      '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'pcm_s16le', '-shortest', src,
    ]);
    expect(Number.isFinite((await measureLoudness(src, { I: -14, TP: -1.5 })).I)).toBe(false);
    const out = path.join(dir, 'silent.mp4');
    await finishLoudness(src, out, { I: -14, TP: -1.5 });
    const p = await probe(out);
    expect(p.hasAudio).toBe(true);
    expect(Math.abs(p.duration - 2)).toBeLessThanOrEqual(1 / 30 + 1e-6);
  });
});
