import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { layoutRegion, faceState } from '../../lib/compile/layers';
import { TV_BT709_TAGS, WORKING_CLIP_X264 } from '../../lib/media/color';

const ctx = { width: 1080, height: 1920, fps: 60, ratio: '9:16' as const, assetsUrl: (p: string) => p };
const src = (f: string) => readFileSync(new URL(`../../lib/${f}`, import.meta.url), 'utf8');

describe('shared defaults', () => {
  it('layoutRegion(undefined) is the full-face region, like every other default layout', () => {
    expect(layoutRegion(undefined, ctx)).toEqual(layoutRegion('full-face', ctx));
    expect(faceState('full-face', ctx, undefined)).toMatchObject({ x: 0, y: 0, width: 1080, height: 1920, opacity: 1 });
  });

  it('one TV-range BT.709 tag set and one working-clip x264 encode, used by prepare, trim and layered', () => {
    expect(TV_BT709_TAGS).toEqual(['-color_range', 'tv', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
      '-x264-params', 'colorprim=bt709:transfer=bt709:colormatrix=bt709']);
    expect(WORKING_CLIP_X264).toEqual(['-c:v', 'libx264', '-preset', 'slow', '-crf', '4', '-g', '30', ...TV_BT709_TAGS]);
    for (const f of ['media/prepare.ts', 'talking/trim.ts', 'render/layered.ts']) {
      const s = src(f);
      expect(s, f).not.toMatch(/colorprim=bt709|'-color_primaries'/);
      expect(s, f).toMatch(/TV_BT709_TAGS|WORKING_CLIP_X264/);
    }
  });

  it('one resolveAsset for compile and layered', () => {
    for (const f of ['compile/index.ts', 'render/layered.ts']) {
      expect(src(f), f).toMatch(/from '\.\.\/media\/assets'/);
      expect(src(f), f).not.toMatch(/function resolveAsset|function normAsset|BUNDLED_ASSETS = /);
    }
  });
});
