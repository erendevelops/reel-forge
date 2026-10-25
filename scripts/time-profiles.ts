// Smoke timing: renders a 3 s synthetic plan with the draft and final profiles and prints wall times.
// Usage: npx tsx scripts/time-profiles.ts
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { makeClip } from '../tests/helpers/media';
import { prepareClip } from '../lib/media/prepare';
import { run } from '../lib/media/run';
import { validatePlan } from '../lib/plan';
import { renderLayered } from '../lib/render/layered';

const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'rf-profiles-'));
try {
  const assets = path.join(tmp, 'media');
  await fs.mkdir(assets);
  const raw = await makeClip(assets, { w: 540, h: 960, fps: 30, seconds: 4 });
  await prepareClip(raw, path.join(assets, 'shot.mp4'), { from: 0, duration: 3, width: 1080, height: 1920, fps: 60 });
  await run('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=220:sample_rate=48000:duration=3', path.join(assets, 'vo.wav')]);
  const v = validatePlan({
    version: 1, lang: 'en', mode: 'reel', fps: 60, duration: 3, ratios: ['9:16'],
    selection: { captions: 'none', layouts: ['broll'], cards: ['title-card'], sfx: false, music: false, punchIns: false, thumbnail: false },
    scenes: [{
      id: 's1', start: 0, end: 3, say: 'x', why: 'x', layout: 'broll',
      shots: [{ src: 'shot.mp4', from: 0, to: 3, at: 0 }],
      cards: [{ type: 'title-card', start: 1.0, end: 2.5, params: { n: 1, name: 'Test' } }],
    }],
    captions: { style: 'none', groups: [] }, sfx: [], voice: { src: 'vo.wav' },
  });
  if (!v.ok) throw new Error(v.errors.join('\n'));
  for (const profile of ['draft', 'final'] as const) {
    const t0 = Date.now();
    await renderLayered(v.plan, { assetsDir: assets, workDir: path.join(tmp, `work-${profile}`), out: path.join(tmp, `${profile}.mp4`), ratio: '9:16', profile });
    console.log(`${profile}: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  }
} finally {
  await fs.rm(tmp, { recursive: true, force: true });
}
