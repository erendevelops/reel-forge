import { describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { compile } from '../../lib/compile';
import { validatePlan } from '../../lib/plan';

const appPlan = (look?: unknown) => ({
  version: 1, lang: 'en', mode: 'app', fps: 30, duration: 3, ratios: ['16:9'],
  selection: { captions: 'none', layouts: ['full-graphics'], cards: ['typed-title'], sfx: false, music: false, punchIns: false, thumbnail: false },
  scenes: [{ id: 's1', start: 0, end: 3, say: '', why: 'x', layout: 'full-graphics', shots: [], cards: [{ type: 'typed-title', start: 0.5, end: 2.5, params: { text: 'prao' } }] }],
  captions: { style: 'none', groups: [] }, sfx: [],
  ...(look ? { look } : {}),
});

describe('plan look', () => {
  it('full-graphics panel uses look.background', async () => {
    const v = validatePlan(appPlan({ background: '#0B0B0C' }));
    if (!v.ok) throw new Error(v.errors.join('\n'));
    const out = await mkdtemp(path.join(os.tmpdir(), 'look-'));
    try {
      const { indexHtml } = await compile(v.plan, { outDir: out, assetsDir: out, ratio: '16:9' });
      expect(indexHtml.toLowerCase()).toContain('#0b0b0c');
      expect(indexHtml.toLowerCase()).not.toContain('#f7f3ea');
    } finally {
      await rm(out, { recursive: true, force: true });
    }
  });

  it('app plan without look.background is rejected', () => {
    const v = validatePlan(appPlan());
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.errors.join('\n')).toMatch(/app videos need look.background/);
  });

  it('look colours must be hex', () => {
    expect(validatePlan(appPlan({ background: 'red; x' })).ok).toBe(false);
  });
});
