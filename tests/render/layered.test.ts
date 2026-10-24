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
      const v = validatePlan({
        version: 1, mode: 'reel', fps: 60, duration: 3, ratios: ['9:16'],
        selection: { captions: 'none', layouts: ['broll'], cards: ['title-card'], sfx: true, music: false, punchIns: true, thumbnail: false },
        scenes: [{
          id: 's1', start: 0, end: 3, say: 'x', why: 'x', layout: 'broll',
          shots: [{ src: 'shot.mp4', from: 0, to: 3, at: 0, punch: 2.9 }],
          cards: [{ type: 'title-card', start: 1.5, end: 2.8, params: { n: 1, name: 'Test' } }],
        }],
        captions: { style: 'none', groups: [] }, sfx: [{ file: 'tick.wav', at: 1.0, volume: 0.5 }], voice: { src: 'vo.wav' },
      });
      if (!v.ok) throw new Error(v.errors.join('\n'));
      const out = path.join(tmp, 'layered.mp4');
      await renderLayered(v.plan, { assetsDir: assets, workDir: path.join(tmp, 'work'), out, ratio: '9:16' });
      const report = await qa(out, {
        fps: 60, frames: 180, duration: 3, width: 1080, height: 1920, lufs: -14,
        lumaRefs: [{ src: clip, srcT: 0.2, outT: 0.2 }],
      });
      expect(report.pass, JSON.stringify(report.checks)).toBe(true);
      // under the title card the composite must differ from the plain footage
      const a = await lumaStats(out, 2.0, 270, 480);
      const b = await lumaStats(clip, 2.0, 270, 480);
      expect(Math.abs(a.yavg - b.yavg)).toBeGreaterThan(1);
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  }, 900000);
});
