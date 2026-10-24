import { describe, it, expect } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { run } from '../../lib/media/run';
import { prepareClip, lumaStats } from '../../lib/media/prepare';
import { makeClip } from '../helpers/media';
import { validatePlan } from '../../lib/plan';
import { qa } from '../../lib/render/qa';
import { renderLayered } from '../../lib/render/layered';

async function grab(f: string, t: number, name: string, dir: string): Promise<string> {
  const png = path.join(dir, name);
  await run('ffmpeg', ['-y', '-v', 'error', '-ss', String(t), '-i', f, '-frames:v', '1', '-vf', 'scale=270:480', png]);
  return png;
}
async function psnr(a: string, b: string): Promise<number> {
  const { stderr } = await run('ffmpeg', ['-hide_banner', '-i', a, '-i', b, '-lavfi', 'psnr', '-f', 'null', '-']);
  const m = /average:([\d.]+|inf)/.exec(stderr);
  if (!m) throw new Error('psnr not found');
  return m[1] === 'inf' ? 99 : Number(m[1]);
}

describe('layered render', () => {
  it('layered output matches footage luma', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'layered-'));
    try {
      const assets = path.join(tmp, 'media');
      await fs.mkdir(assets);
      const raw = await makeClip(assets, { w: 540, h: 960, fps: 30, seconds: 4 });
      const clip = path.join(assets, 'shot.mp4');
      await prepareClip(raw, clip, { from: 0, duration: 3, width: 1080, height: 1920, fps: 60 });
      await run('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=220:sample_rate=48000:duration=3', path.join(assets, 'vo.wav')]);
      await run('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=880:sample_rate=48000:duration=0.3', path.join(assets, 'tick.wav')]);
      await run('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=110:sample_rate=48000:duration=4', path.join(assets, 'bed.wav')]);
      const v = validatePlan({
        version: 1, mode: 'reel', fps: 60, duration: 3, ratios: ['9:16'],
        selection: { captions: 'none', layouts: ['broll'], cards: ['title-card'], sfx: true, music: true, punchIns: true, thumbnail: false },
        scenes: [{
          id: 's1', start: 0, end: 3, say: 'x', why: 'x', layout: 'broll',
          shots: [{ src: 'shot.mp4', from: 0, to: 3, at: 0, punch: 2.9 }],
          cards: [{ type: 'title-card', start: 1.5, end: 2.8, params: { n: 1, name: 'Test' } }],
        }],
        captions: { style: 'none', groups: [] }, sfx: [{ file: 'tick.wav', at: 1.0, volume: 0.5 }], voice: { src: 'vo.wav' },
        music: { src: 'bed.wav', mediaStart: 0, volume: 0.3, fadeOut: 0.5 },
      });
      if (!v.ok) throw new Error(v.errors.join('\n'));
      const out = path.join(tmp, 'layered.mp4');
      await renderLayered(v.plan, { assetsDir: assets, workDir: path.join(tmp, 'work'), out, ratio: '9:16' });
      const report = await qa(out, {
        fps: 60, frames: 180, duration: 3, width: 1080, height: 1920, lufs: -14,
        lumaRefs: [{ src: clip, srcT: 0.2, outT: 0.2 }],
      });
      expect(report.pass, JSON.stringify(report.checks)).toBe(true);
      // untouched footage must be faithful: no range/matrix drift
      const u = await lumaStats(out, 0.2, 270, 480);
      const r = await lumaStats(clip, 0.2, 270, 480);
      expect(Math.abs(u.yavg - r.yavg)).toBeLessThanOrEqual(0.5);
      // under the title card the composite must differ from the plain footage
      // (the card is small, so whole-frame yavg moves < 1; a frame PSNR drop is the sensitive signal)
      const cardPsnr = await psnr(await grab(out, 2.0, 'c1.png', tmp), await grab(clip, 2.0, 'c2.png', tmp));
      const cleanPsnr = await psnr(await grab(out, 0.2, 'c3.png', tmp), await grab(clip, 0.2, 'c4.png', tmp));
      expect(cardPsnr).toBeLessThan(cleanPsnr - 5);
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  }, 900000);

  it('places shots at their `at` times, hands off, and eases the punch-in', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'layered-'));
    try {
      const assets = path.join(tmp, 'media');
      await fs.mkdir(assets);
      const rawRed = path.join(assets, 'red-raw.mp4');
      await run('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=red:s=540x960:r=30:d=2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', rawRed]);
      const red = path.join(assets, 'red.mp4');
      await prepareClip(rawRed, red, { from: 0, duration: 1, width: 1080, height: 1920, fps: 60 });
      const raw = await makeClip(assets, { w: 540, h: 960, fps: 30, seconds: 4 });
      const test = path.join(assets, 'test.mp4');
      await prepareClip(raw, test, { from: 0, duration: 3, width: 1080, height: 1920, fps: 60 });
      const v = validatePlan({
        version: 1, mode: 'reel', fps: 60, duration: 3, ratios: ['9:16'],
        selection: { captions: 'none', layouts: ['broll'], cards: [], sfx: false, music: false, punchIns: true, thumbnail: false },
        scenes: [{
          id: 's1', start: 0, end: 3, say: 'x', why: 'x', layout: 'broll',
          shots: [
            { src: 'red.mp4', from: 0, to: 1, at: 0 },
            { src: 'test.mp4', from: 0.5, to: 2.2, at: 1.3, punch: 1.4 }, // ease 1.4..2.6, mid at 2.0
          ],
          cards: [],
        }],
        captions: { style: 'none', groups: [] }, sfx: [],
      });
      if (!v.ok) throw new Error(v.errors.join('\n'));
      const out = path.join(tmp, 'multi.mp4');
      await renderLayered(v.plan, { assetsDir: assets, workDir: path.join(tmp, 'work'), out, ratio: '9:16' });
      const report = await qa(out, { fps: 60, frames: 180, duration: 3, width: 1080, height: 1920 });
      expect(report.pass, JSON.stringify(report.checks)).toBe(true);
      const y = async (f: string, t: number) => (await lumaStats(f, t, 270, 480)).yavg;
      // shot 1 (red) then a black gap, then shot 2 at its `at` with source offset `from`
      expect(Math.abs((await y(out, 0.5)) - (await y(red, 0.5)))).toBeLessThanOrEqual(1);
      expect(await y(out, 1.15)).toBeLessThan(20);
      expect(Math.abs((await y(out, 1.4)) - (await y(test, 0.6)))).toBeLessThanOrEqual(1.5);
      expect(Math.abs((await y(out, 1.4)) - (await y(red, 0.5)))).toBeGreaterThan(20);
      // mid-ease (scale ~1.06) must differ from the unpunched source frame; before the punch it must not
      const mid = await psnr(await grab(out, 2.0, 'o1.png', tmp), await grab(test, 1.2, 'r1.png', tmp));
      const pre = await psnr(await grab(out, 1.4, 'o2.png', tmp), await grab(test, 0.6, 'r2.png', tmp));
      expect(mid).toBeLessThan(30);
      expect(pre).toBeGreaterThan(35);
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  }, 900000);
});
