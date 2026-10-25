import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { run } from '../../lib/media/run';
import { qa, expectsAudio, footageLumaRegion, type QaExpect } from '../../lib/render/qa';
import { faceRect } from '../../lib/compile/layers';
import { CAPTION_TOP } from '../../lib/compile/captions';

/** Small synthetic deliverables (no HyperFrames render): ffmpeg lavfi only. */
let tmp: string;
const TAGS = ['-color_range', 'tv', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709'];
const X264 = ['-x264-params', 'colorprim=bt709:transfer=bt709:colormatrix=bt709'];
const W = 270;
const H = 480;

async function clip(name: string, o: { video: number; audio?: number }): Promise<string> {
  const f = path.join(tmp, name);
  const args = ['-y', '-v', 'error', '-f', 'lavfi', '-i', `testsrc2=size=${W}x${H}:rate=30:duration=${o.video}`];
  if (o.audio !== undefined) args.push('-f', 'lavfi', '-i', `sine=frequency=440:sample_rate=48000:duration=${o.audio}`);
  args.push('-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', ...TAGS, ...X264);
  if (o.audio !== undefined) args.push('-c:a', 'aac');
  args.push(f);
  await run('ffmpeg', args);
  return f;
}

const fmt = (file: string, e: Partial<QaExpect>) =>
  qa(file, { fps: 30, frames: 60, duration: 2, width: W, height: H, ...e }).then((r) => r.checks.find((c) => c.name === 'format')!);

beforeAll(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'qa-'));
});
afterAll(async () => {
  if (tmp) await fs.rm(tmp, { recursive: true, force: true });
});

describe('qa format gate: audio stream', () => {
  it('expectsAudio: voice, music or sfx', () => {
    const base = { voice: undefined, music: undefined, sfx: [] } as never;
    expect(expectsAudio(base)).toBe(false);
    expect(expectsAudio({ ...(base as object), voice: { src: 'v.wav' } } as never)).toBe(true);
    expect(expectsAudio({ ...(base as object), sfx: [{ file: 'a.wav', at: 0, volume: 1 }] } as never)).toBe(true);
  });

  it('a deliverable without audio fails when the plan has audio', async () => {
    const silent = await clip('silent.mp4', { video: 2 });
    const c = await fmt(silent, { audio: true });
    expect(c.pass, c.detail).toBe(false);
    expect(c.detail).toMatch(/no audio stream/);
    // a plan without audio does not need one
    expect((await fmt(silent, { audio: false })).pass).toBe(true);
  }, 120000);

  it("checks the audio stream's duration (it used to be hidden by -select_streams v:0)", async () => {
    const short = await clip('short-audio.mp4', { video: 2, audio: 1 });
    const c = await fmt(short, { audio: true });
    expect(c.pass, c.detail).toBe(false);
    expect(c.detail).toMatch(/"audio":1(\.\d+)?[,}]/);
    const good = await clip('good.mp4', { video: 2, audio: 2 });
    const g = await fmt(good, { audio: true });
    expect(g.pass, g.detail).toBe(true);
  }, 120000);
});

describe('qa: footage luma on the deliverable', () => {
  it('footageLumaRegion: full-face skips the caption and card bands; split stays inside the face card', () => {
    const ff = footageLumaRegion('full-face', 1080, 1920);
    expect(ff.region.y + ff.region.h).toBeLessThanOrEqual(CAPTION_TOP + 1e-9);
    expect(ff.srcRegion).toEqual(ff.region);
    const sp = footageLumaRegion('split', 1080, 1920);
    const r = faceRect('split', 1080, 1920);
    expect(sp.region.x * 1080).toBeGreaterThan(r.x);
    expect((sp.region.x + sp.region.w) * 1080).toBeLessThan(r.x + r.w);
    expect(sp.region.y * 1920).toBeGreaterThan(r.y);
    expect((sp.region.y + sp.region.h) * 1920).toBeLessThan(r.y + r.h);
    // never over the captions
    const cap: [number, number] = [CAPTION_TOP, CAPTION_TOP + 0.12];
    expect(sp.region.y >= cap[1] || sp.region.y + sp.region.h <= cap[0]).toBe(true);
    // the same area in the source's own frame (the split card shows the whole source)
    expect(sp.srcRegion.x).toBeCloseTo((sp.region.x * 1080 - r.x) / r.w, 6);
    expect(sp.srcRegion.h).toBeCloseTo((sp.region.h * 1920) / r.h, 6);
    expect(() => footageLumaRegion('full-graphics', 1080, 1920)).toThrow(/no footage/);
  });

  it('split deliverable: the face-card region matches the source, the whole frame does not', async () => {
    // 1080×1920 like a reel (small frames make the 2× card downscale too coarse for a ±3 gate)
    const [FW, FH] = [1080, 1920];
    const src = path.join(tmp, 'face.mp4');
    await run('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', `testsrc2=size=${FW}x${FH}:rate=30:duration=2`,
      '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '10', '-pix_fmt', 'yuv420p', ...TAGS, ...X264, src]);
    const r = faceRect('split', FW, FH);
    const [x, y, w, h] = [Math.round(r.x), Math.round(r.y), Math.round(r.w), Math.round(r.h)];
    const cap = Math.round(CAPTION_TOP * FH);
    // beige panel, the source contained in the face card, a white card on top and a caption over the face
    const out = path.join(tmp, 'split.mp4');
    await run('ffmpeg', [
      '-y', '-v', 'error', '-f', 'lavfi', '-i', `color=c=0xF7F3EA:s=${FW}x${FH}:r=30:d=2`, '-i', src,
      '-filter_complex',
      `[1:v]scale=${w}:${h}:flags=lanczos[f];[0:v][f]overlay=${x}:${y},` +
      `drawbox=x=40:y=80:w=${FW - 80}:h=${Math.round(FH * 0.35)}:color=white:t=fill,` +
      `drawbox=x=${x}:y=${cap}:w=${w}:h=${Math.round(FH * 0.05)}:color=yellow:t=fill,format=yuv420p`,
      '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '10', ...TAGS, ...X264, out,
    ]);
    const { region, srcRegion } = footageLumaRegion('split', FW, FH);
    const e = { fps: 30, frames: 60, duration: 2, width: FW, height: FH };
    const ref = { src, srcT: 1, outT: 1 };
    const ok = (await qa(out, { ...e, deliverableLumaRefs: [{ ...ref, region, srcRegion }] })).checks.find((c) => c.name === 'deliverableLuma')!;
    expect(ok.pass, ok.detail).toBe(true);
    const whole = (await qa(out, { ...e, deliverableLumaRefs: [{ ...ref, region: { x: 0, y: 0, w: 1, h: 1 } }] })).checks.find((c) => c.name === 'deliverableLuma')!;
    expect(whole.pass, whole.detail).toBe(false);
  }, 120000);
});
