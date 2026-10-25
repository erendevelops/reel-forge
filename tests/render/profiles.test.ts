import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PROFILES, hfRenderArgs } from '../../lib/render/profiles';
import { baseArgs, compositeArgs } from '../../lib/render/layered';
import { validatePlan } from '../../lib/plan';

const fixture = JSON.parse(readFileSync(path.join(__dirname, '../fixtures/plan-reel-v5.json'), 'utf8'));
const plan = (() => {
  const r = validatePlan(fixture);
  if (!r.ok) throw new Error(r.errors.join('\n'));
  // Encode args don't depend on the shots; dropping them avoids resolving real media files.
  return { ...r.plan, scenes: r.plan.scenes.map((s) => ({ ...s, shots: [] })) };
})();
const opts = { assetsDir: path.join(__dirname, '../fixtures'), workDir: 'w', out: 'o.mp4', ratio: '9:16' as const };
const argAfter = (args: string[], flag: string) => args[args.indexOf(flag) + 1];

describe('render profiles', () => {
  it('draft profile uses x264 veryfast base and crf 23 composite', () => {
    const base = baseArgs(plan, { ...opts, profile: 'draft' }, 1080, 1920, 'b.mkv');
    expect(argAfter(base, '-c:v')).toBe('libx264');
    expect(argAfter(base, '-preset')).toBe('veryfast');
    expect(argAfter(base, '-crf')).toBe('16');
    const comp = compositeArgs({ base: 'b', overlay: 'o', mix: 'm', out: 'c', duration: 32, profile: 'draft' });
    expect(argAfter(comp, '-crf')).toBe('23');
    expect(argAfter(comp, '-preset')).toBe('veryfast');
    expect(hfRenderArgs('draft')).toEqual(['--quality', 'draft']);
  });

  it('final profile keeps ffv1 base and crf 10', () => {
    const base = baseArgs(plan, { ...opts, profile: 'final' }, 1080, 1920, 'b.mkv');
    expect(argAfter(base, '-c:v')).toBe('ffv1');
    const comp = compositeArgs({ base: 'b', overlay: 'o', mix: 'm', out: 'c', duration: 32, profile: 'final' });
    expect(argAfter(comp, '-crf')).toBe('10');
    expect(argAfter(comp, '-preset')).toBe('slow');
    expect(hfRenderArgs('final')).toEqual(['--quality', 'delivery']);
    expect(PROFILES.final.qa).toBe('full');
    expect(PROFILES.draft.qa).toBe('skip');
  });

  it('both profiles keep BT.709 tags and x264 colour params', () => {
    for (const profile of ['draft', 'final'] as const) {
      const base = baseArgs(plan, { ...opts, profile }, 1080, 1920, 'b.mkv');
      const comp = compositeArgs({ base: 'b', overlay: 'o', mix: 'm', out: 'c', duration: 32, profile });
      for (const args of [base, comp]) {
        expect(argAfter(args, '-color_primaries')).toBe('bt709');
        expect(argAfter(args, '-color_trc')).toBe('bt709');
        expect(argAfter(args, '-colorspace')).toBe('bt709');
        expect(argAfter(args, '-color_range')).toBe('tv');
      }
      expect(argAfter(comp, '-x264-params')).toContain('colorprim=bt709');
      if (profile === 'draft') expect(argAfter(base, '-x264-params')).toContain('colorprim=bt709');
      // Never a colour filter on footage, in any profile.
      expect(base.join(' ')).not.toMatch(/\beq=|lut|colorbalance|curves/);
    }
  });

  it('an explicit crf still overrides the profile composite crf', () => {
    expect(argAfter(compositeArgs({ base: 'b', overlay: 'o', mix: 'm', out: 'c', duration: 3, profile: 'final', crf: 14 }), '-crf')).toBe('14');
  });
});
