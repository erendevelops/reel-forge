import { describe, it, expect, afterAll } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Plan } from '../../lib/plan';
import { validatePlan } from '../../lib/plan';
import { renderFootage } from '../../lib/compile/layers';
import { baseArgs } from '../../lib/render/layered';
import { run } from '../../lib/media/run';

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

// baseArgs resolves every asset (clear missing-file error), so the referenced clips must exist
const assetsDir = mkdtempSync(path.join(os.tmpdir(), 'nfz-'));
for (const f of ['v.mp4', 'wide.mp4']) writeFileSync(path.join(assetsDir, f), '');
afterAll(() => rmSync(assetsDir, { recursive: true, force: true }));
const SIZES = { 'v.mp4': { width: 1080, height: 1920 }, 'wide.mp4': { width: 1920, height: 1080 } };

const filter = (p: Plan, sizes: Record<string, { width: number; height: number }> | null = SIZES) => {
  const a = baseArgs(p, { assetsDir, workDir: assetsDir, out: 'o.mp4', ratio: '9:16' }, 1080, 1920, 'base.mkv', sizes ?? undefined);
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

  it("layered base: the punch-in crops back to the clip's own size, not the output frame", () => {
    const chains = filter(plan(true)).split(';');
    // full-face clip at output size: 1080x1920; the 16:9 split source: 1920x1080 (cropping it to 1080x1920 broke it)
    expect(chains.find((c) => c.startsWith('[1:v]'))).toContain('crop=1080:1920');
    const wide = chains.find((c) => c.startsWith('[2:v]'))!;
    expect(wide).toContain('crop=1920:1080');
    expect(wide).not.toContain('crop=1080:1920');
    // without the clip size a punch on a shot whose aspect differs from the frame is refused, never mis-cropped
    expect(() => filter(plan(true), null)).toThrow(/wide\.mp4.*size/);
  });

  it('layered base: a punched 16:9 shot in a split scene encodes (tiny frame, ffmpeg only)', async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'nfz-run-'));
    try {
      await run('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=192x108:rate=30:duration=1', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', path.join(dir, 'wide.mp4')]);
      const p: Plan = {
        ...plan(true), duration: 1,
        scenes: [{ id: 'b', start: 0, end: 1, say: 'x', why: 'x', layout: 'split', shots: [{ src: 'wide.mp4', from: 0, to: 1, at: 0, aspect: 16 / 9, punch: 0.2 }], cards: [] }],
      };
      const out = path.join(dir, 'base.mkv');
      const args = baseArgs({ ...p, fps: 30 }, { assetsDir: dir, workDir: dir, out, ratio: '9:16' }, 108, 192, out, { 'wide.mp4': { width: 192, height: 108 } });
      expect(args[args.indexOf('-filter_complex') + 1]).toContain('crop=192:108');
      await run('ffmpeg', args);
      const { stdout } = await run('ffprobe', ['-v', 'error', '-count_frames', '-show_entries', 'stream=width,height,nb_read_frames', '-of', 'csv=p=0', out]);
      expect(stdout.trim()).toBe('108,192,30');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60000);

  it('baseArgs: a missing asset is a clear error (shared resolveAsset)', () => {
    const p = plan(false);
    p.scenes[0].shots[0].src = 'missing.mp4';
    expect(() => filter(p)).toThrow(/missing asset: missing\.mp4/);
    p.scenes[0].shots[0].src = '../escape.mp4';
    expect(() => filter(p)).toThrow(/relative to assetsDir/);
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
