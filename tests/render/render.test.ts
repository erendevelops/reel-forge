import { describe, it, expect } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { run } from '../../lib/media/run';
import { prepareClip, finishLoudness } from '../../lib/media/prepare';
import { makeClip } from '../helpers/media';
import { validatePlan } from '../../lib/plan';
import { compile } from '../../lib/compile';
import { render } from '../../lib/render/render';
import { qa, writeQa } from '../../lib/render/qa';

describe('render + qa', () => {
  it('renders a 3 s synthetic plan and passes QA', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'render-'));
    try {
      const assets = path.join(tmp, 'media');
      await fs.mkdir(assets);
      const raw = await makeClip(assets, { w: 540, h: 960, fps: 30, seconds: 4 });
      const clip = path.join(assets, 'shot.mp4');
      await prepareClip(raw, clip, { from: 0, duration: 3, width: 1080, height: 1920, fps: 60 });
      await run('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=220:sample_rate=48000:duration=3', path.join(assets, 'vo.wav')]);
      const v = validatePlan({
        version: 1, lang: 'en', mode: 'reel', fps: 60, duration: 3, ratios: ['9:16'],
        selection: { captions: 'none', layouts: ['broll'], cards: ['title-card'], sfx: false, music: false, punchIns: false, thumbnail: false },
        scenes: [{
          id: 's1', start: 0, end: 3, say: 'x', why: 'x', layout: 'broll',
          shots: [{ src: 'shot.mp4', from: 0, to: 3, at: 0 }],
          cards: [{ type: 'title-card', start: 1.5, end: 2.8, params: { n: 1, name: 'Test' } }],
        }],
        captions: { style: 'none', groups: [] }, sfx: [], voice: { src: 'vo.wav' },
      });
      if (!v.ok) throw new Error(v.errors.join('\n'));
      const proj = path.join(tmp, 'proj');
      await compile(v.plan, { outDir: proj, assetsDir: assets, ratio: '9:16' });
      const rendered = path.join(tmp, 'rendered.mp4');
      await render(proj, rendered, { fps: 60 });
      const rawTags = (await run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=pix_fmt,color_range,color_space,color_transfer,color_primaries', '-of', 'csv=p=0', rendered])).stdout.trim();
      expect(rawTags).toBe('yuv420p,tv,bt709,bt709,bt709'); // hyperframes output needs no remux
      const final = path.join(tmp, 'final.mp4');
      await finishLoudness(rendered, final, { I: -14, TP: -1.5 });
      const report = await qa(final, {
        fps: 60, frames: 180, duration: 3, width: 1080, height: 1920, lufs: -14, audio: true,
        lumaRefs: [{ src: clip, srcT: 1.0, outT: 1.0 }],
      });
      await writeQa(tmp, report);
      expect(report.checks.map((c) => c.name)).toEqual(['format', 'loudness', 'luma', 'contactSheet']);
      expect(report.pass).toBe(true);
      expect(report.checks[0].detail).toContain('"dur"');
      // a plan-duration mismatch must fail the format gate
      const bad = await qa(final, { fps: 60, frames: 180, duration: 3.5, width: 1080, height: 1920 });
      expect(bad.checks[0].pass).toBe(false);
      expect(bad.pass).toBe(false);
      await expect(fs.stat(`${final}.sheet.jpg`)).resolves.toBeTruthy();
      await expect(fs.stat(path.join(tmp, 'qa.json'))).resolves.toBeTruthy();
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  }, 600000);

  it('luma gate measures footage only: lumaFile and lumaRegion skip overlay pixels', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'qa-luma-'));
    try {
      const raw = await makeClip(tmp, { w: 540, h: 960, fps: 30, seconds: 3 });
      const clip = path.join(tmp, 'clip.mp4');
      await prepareClip(raw, clip, { from: 0, duration: 2, width: 1080, height: 1920, fps: 60 });
      // an "overlay": a white card over the top 40 % of the frame, footage untouched below it
      const boxed = path.join(tmp, 'boxed.mp4');
      await run('ffmpeg', [
        '-y', '-v', 'error', '-i', clip, '-vf', 'drawbox=x=0:y=0:w=iw:h=ih*0.4:color=white:t=fill',
        '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '4', '-pix_fmt', 'yuv420p',
        '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', boxed,
      ]);
      const base = { fps: 60, frames: 138, duration: 2.3, width: 1080, height: 1920, lumaRefs: [{ src: clip, srcT: 1.0, outT: 1.0 }] };
      const luma = async (e: Parameters<typeof qa>[1]) => (await qa(boxed, e)).checks.find((c) => c.name === 'luma')!;
      const whole = await luma(base);
      expect(whole.pass, whole.detail).toBe(false); // whole-frame mean sees the card
      const region = await luma({ ...base, lumaRegion: { x: 0, y: 0.5, w: 1, h: 0.5 } });
      expect(region.pass, region.detail).toBe(true);
      expect(region.detail).toContain('region');
      const file = await luma({ ...base, lumaFile: clip });
      expect(file.pass, file.detail).toBe(true);
      expect(file.detail).toContain('footage file clip.mp4');
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  }, 300000);
});
