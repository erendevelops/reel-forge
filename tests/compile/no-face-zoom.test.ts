import { describe, it, expect } from 'vitest';
import type { Plan } from '../../lib/plan';
import { validatePlan } from '../../lib/plan';
import { renderFootage } from '../../lib/compile/layers';
import { baseArgs } from '../../lib/render/layered';

const ctx = { width: 1080, height: 1920, fps: 60, ratio: '9:16' as const, assetsUrl: (p: string) => `assets/${p}` };

/** Split talking head: full-face hook, split body with a 16:9 source, both with a punch on the shot. */
function plan(punchIns: boolean): Plan {
  return {
    version: 1, lang: 'en', mode: 'reel', fps: 60, duration: 6, ratios: ['9:16'],
    selection: { captions: 'none', layouts: ['full-face', 'split'], cards: [], sfx: false, music: false, punchIns, thumbnail: false, topicAssets: false },
    scenes: [
      { id: 'a', start: 0, end: 3, say: 'x', why: 'x', layout: 'full-face', facePos: { x: 0.4, y: 0.3 }, shots: [{ src: 'v.mp4', from: 0, to: 3, at: 0, punch: 1 }], cards: [] },
      { id: 'b', start: 3, end: 6, say: 'x', why: 'x', layout: 'split', facePos: { x: 0.5, y: 0.2 }, shots: [{ src: 'wide.mp4', from: 3, to: 6, at: 3, aspect: 16 / 9, punch: 4 }], cards: [] },
    ],
    captions: { style: 'none', groups: [] }, sfx: [],
  };
}

const filter = (p: Plan) => {
  const a = baseArgs(p, { assetsDir: 'C:/nowhere', workDir: 'C:/nowhere', out: 'o.mp4', ratio: '9:16' }, 1080, 1920, 'base.mkv');
  return a[a.indexOf('-filter_complex') + 1];
};

describe('no face zoom', () => {
  it('validatePlan rejects punch-ins unless selected', () => {
    const v = validatePlan(plan(false));
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.errors.join('\n')).toMatch(/punch-ins used but not selected/);
    expect(validatePlan(plan(true)).ok).toBe(true);
  });

  it('compile emits no punch-in unless selected (even for an unvalidated plan)', () => {
    expect(renderFootage(plan(false), ctx).timeline).not.toMatch(/punchEase|scale: 1\.08/);
    expect(renderFootage(plan(true), ctx).timeline).toMatch(/tl\.fromTo\("#shot-1", \{ scale: 1 \}/);
  });

  it('layered base: no punch-in scale unless selected', () => {
    expect(filter(plan(false))).not.toMatch(/eval=frame:flags=bicubic/);
    expect(filter(plan(true))).toMatch(/eval=frame:flags=bicubic/);
  });

  it('layered base: the split face card contains the source frame (no crop), centred, full-face pans the widest cover', () => {
    const f = filter(plan(false));
    const chains = f.split(';');
    const split = chains.find((c) => c.startsWith('[2:v]'))!;
    // contain: scale by the smaller of the rect/source ratios, from the clip's own size
    expect(split).toMatch(/scale=w='trunc\(iw\*min\(/);
    expect(split).not.toMatch(/max\(/);
    const ov = chains.find((c) => c.includes('[s1]overlay'))!;
    expect(ov).toContain('-overlay_w)*0.5');
    expect(ov).toContain('-overlay_h)*0.5');
    expect(ov).not.toContain('*0.2'); // facePos.y no longer crops the split card
    // the full-face scene shows the clip full frame: no layout scale at all
    expect(chains.find((c) => c.startsWith('[1:v]'))).not.toMatch(/lanczos/);
  });
});
