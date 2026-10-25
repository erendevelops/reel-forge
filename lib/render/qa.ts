import fs from 'node:fs/promises';
import path from 'node:path';
import { run } from '../media/run';
import { lumaStats } from '../media/prepare';
import { probe } from '../media/probe';
import type { Layout, Plan } from '../plan';
import { FULL_FACE_CARD_TOP, faceRect } from '../compile/layers';
import { CAPTION_TOP } from '../compile/captions';

export interface QaExpect {
  fps: number;
  frames: number;
  /** Plan duration in seconds; container and every stream must match within one frame. */
  duration: number;
  width: number;
  height: number;
  lufs?: number;
  /**
   * Footage luma refs: frame `outT` of the measured file vs frame `srcT` of the working clip `src`, |Δ yavg| ≤ 3.
   * The gate is about footage colour, so it must not see overlay pixels: measure a footage-only file (`lumaFile`,
   * e.g. the layered path's lossless base track) and/or restrict both frames to an overlay-free `lumaRegion`.
   */
  lumaRefs?: { src: string; srcT: number; outT: number }[];
  /** File the luma refs are measured on instead of the deliverable (layered path: `renderLayered(...).base`). */
  lumaFile?: string;
  /** Fractions of the frame (0–1) both frames are cropped to before measuring; default the whole frame. */
  lumaRegion?: LumaRegion;
  /**
   * Footage colour on the deliverable itself (the base-track gate cannot see the final encode/composite): frame
   * `outT` of the deliverable cropped to `region` (an area no overlay touches, e.g. `footageLumaRegion`) vs frame
   * `srcT` of the working clip `src` cropped to `srcRegion` (default `region`), |Δ yavg| ≤ 3.
   */
  deliverableLumaRefs?: { src: string; srcT: number; outT: number; region: LumaRegion; srcRegion?: LumaRegion }[];
  /** The deliverable must carry an audio stream (plan has voice/music/sfx: `expectsAudio(plan)`); its duration is gated. */
  audio?: boolean;
}
export type LumaRegion = { x: number; y: number; w: number; h: number };
export interface QaCheck { name: string; pass: boolean; detail: string }
export interface QaReport { pass: boolean; checks: QaCheck[] }

/** Whether a plan's deliverable must have an audio stream: any voice, music or SFX. */
export function expectsAudio(plan: Pick<Plan, 'voice' | 'music' | 'sfx'>): boolean {
  return Boolean(plan.voice || plan.music || plan.sfx.length);
}

/** Caption block band the luma regions keep out of (top + two lines of 66 px type, with margin). */
const CAPTION_BAND: [number, number] = [CAPTION_TOP, CAPTION_TOP + 0.12];

/**
 * An overlay-free luma region over the footage of a `layout` scene in a W×H deliverable, and the same area in the
 * source's own frame (`srcRegion`). `split`: inside the face card (`faceRect`, inset past the rounded corners) — the
 * card shows the whole source, so the source area is the region mapped into the card. Full-frame layouts: the frame
 * above the captions (and the full-face card band). The tallest band clear of `avoid` (fractions of H; default the
 * caption block, plus the card band for full-face) is used. Assumes the footage fills its rect exactly (a working clip
 * at output size, or the split card at the source's aspect) and no punch-in is running at the measured time.
 */
export function footageLumaRegion(
  layout: Layout, width: number, height: number, aspect = width / height,
  o: { inset?: number; avoid?: [number, number][] } = {},
): { region: LumaRegion; srcRegion: LumaRegion } {
  if (layout === 'full-graphics') throw new Error('footageLumaRegion: full-graphics scenes show no footage');
  const r = faceRect(layout, width, height, aspect);
  const inset = o.inset ?? 0.08;
  const avoid = o.avoid ?? (layout === 'full-face' ? [CAPTION_BAND, [FULL_FACE_CARD_TOP, 1]] : [CAPTION_BAND]);
  const x0 = r.x + r.w * inset;
  const x1 = r.x + r.w * (1 - inset);
  // vertical candidates: the inset rect minus every avoided band; keep the tallest
  let spans: [number, number][] = [[(r.y + r.h * inset) / height, (r.y + r.h * (1 - inset)) / height]];
  for (const [a, b] of avoid) spans = spans.flatMap(([s, e]) => (b <= s || a >= e ? [[s, e]] : [[s, Math.min(e, a)], [Math.max(s, b), e]]).filter(([u, v]) => v - u > 1e-6) as [number, number][]);
  if (!spans.length) throw new Error(`footageLumaRegion: no overlay-free area in the ${layout} face rect`);
  const [ys, ye] = spans.reduce((best, s) => (s[1] - s[0] > best[1] - best[0] ? s : best));
  const region = { x: x0 / width, y: ys, w: (x1 - x0) / width, h: ye - ys };
  const srcRegion = {
    x: (x0 - r.x) / r.w, y: (ys * height - r.y) / r.h, w: (x1 - x0) / r.w, h: ((ye - ys) * height) / r.h,
  };
  return { region, srcRegion };
}

async function formatCheck(file: string, e: QaExpect): Promise<QaCheck> {
  // every stream: a video-only probe never saw the audio stream, so a deliverable without audio passed
  const { stdout } = await run('ffprobe', [
    '-v', 'error', '-count_frames', '-print_format', 'json', '-show_streams', '-show_format', file,
  ]);
  const j = JSON.parse(stdout);
  const v = j.streams.find((s: any) => s.codec_type === 'video');
  const a = j.streams.find((s: any) => s.codec_type === 'audio');
  const tol = 1 / e.fps + 1e-6;
  const dur = { container: Number(j.format.duration), video: Number(v.duration), audio: a ? Number(a.duration) : undefined };
  const durOk = [dur.container, dur.video, ...(dur.audio === undefined ? [] : [dur.audio])].every((d) => Math.abs(d - e.duration) <= tol);
  const audioOk = !e.audio || a !== undefined;
  const [n, d] = String(v.r_frame_rate).split('/').map(Number);
  const fps = d ? n / d : n;
  const frames = Number(v.nb_read_frames);
  const got = {
    fps: Number(fps.toFixed(3)), frames, w: v.width, h: v.height, range: v.color_range,
    dur, primaries: v.color_primaries, space: v.color_space, trc: v.color_transfer, pix: v.pix_fmt,
    ...(e.audio && !a ? { error: 'no audio stream (the plan has voice/music/sfx)' } : {}),
  };
  const pass = durOk && audioOk && Math.abs(fps - e.fps) < 0.01 && frames === e.frames && v.width === e.width && v.height === e.height
    && v.color_range === 'tv' && v.color_primaries === 'bt709' && v.color_space === 'bt709' && v.color_transfer === 'bt709'
    && v.pix_fmt === 'yuv420p';
  return { name: 'format', pass, detail: JSON.stringify(got) };
}

async function loudnessCheck(file: string, target: number): Promise<QaCheck> {
  const { stderr } = await run('ffmpeg', [
    '-hide_banner', '-nostats', '-i', file, '-vn',
    '-af', `loudnorm=I=${target}:TP=-1.5:LRA=11:print_format=json`, '-f', 'null', '-',
  ]);
  const m = stderr.match(/\{[^{}]*"input_i"[^{}]*\}/);
  if (!m) return { name: 'loudness', pass: false, detail: 'loudnorm output not found' };
  const j = JSON.parse(m[0]);
  const I = Number(j.input_i);
  const TP = Number(j.input_tp);
  const pass = Math.abs(I - target) <= 1 && TP <= -1.5;
  return { name: 'loudness', pass, detail: `I=${I} LUFS (target ${target} ±1), TP=${TP} dBTP (max -1.5)` };
}

async function lumaCheck(file: string, refs: NonNullable<QaExpect['lumaRefs']>, e: QaExpect): Promise<QaCheck> {
  const reg = e.lumaRegion;
  const w = Math.max(2, Math.round((e.width * (reg?.w ?? 1)) / 4));
  const h = Math.max(2, Math.round((e.height * (reg?.h ?? 1)) / 4));
  const measured = e.lumaFile ?? file;
  const parts: string[] = [`on ${e.lumaFile ? `footage file ${path.basename(measured)}` : 'output'}${reg ? ` region ${JSON.stringify(reg)}` : ''}`];
  let pass = true;
  for (const r of refs) {
    const a = await lumaStats(measured, r.outT, w, h, reg);
    const b = await lumaStats(r.src, r.srcT, w, h, reg);
    const d = a.yavg - b.yavg;
    if (!(Math.abs(d) <= 3)) pass = false;
    parts.push(`t=${r.outT}: out=${a.yavg} ref=${b.yavg} d=${d.toFixed(3)}`);
  }
  return { name: 'luma', pass, detail: parts.join('; ') };
}

async function deliverableLumaCheck(file: string, refs: NonNullable<QaExpect['deliverableLumaRefs']>, e: QaExpect): Promise<QaCheck> {
  const parts: string[] = [`on deliverable ${path.basename(file)}`];
  let pass = true;
  for (const r of refs) {
    const w = Math.max(2, Math.round((e.width * r.region.w) / 4));
    const h = Math.max(2, Math.round((e.height * r.region.h) / 4));
    const a = await lumaStats(file, r.outT, w, h, r.region);
    const b = await lumaStats(r.src, r.srcT, w, h, r.srcRegion ?? r.region);
    const d = a.yavg - b.yavg;
    if (!(Math.abs(d) <= 3)) pass = false;
    parts.push(`t=${r.outT} region ${JSON.stringify(r.region)}: out=${a.yavg} ref=${b.yavg} d=${d.toFixed(3)}`);
  }
  return { name: 'deliverableLuma', pass, detail: parts.join('; ') };
}

async function contactSheet(file: string): Promise<QaCheck> {
  const out = `${file}.sheet.jpg`;
  const rows = Math.max(1, Math.ceil(((await probe(file)).duration * 2) / 16));
  await run('ffmpeg', [
    '-y', '-v', 'error', '-i', file, '-an',
    '-vf', `fps=2,scale=135:-2,tile=16x${rows}`,
    '-frames:v', '1', '-q:v', '3', out,
  ]);
  return { name: 'contactSheet', pass: true, detail: out };
}

export async function qa(file: string, expect: QaExpect): Promise<QaReport> {
  const checks: QaCheck[] = [await formatCheck(file, expect)];
  if (expect.lufs !== undefined) checks.push(await loudnessCheck(file, expect.lufs));
  if (expect.lumaRefs?.length) checks.push(await lumaCheck(file, expect.lumaRefs, expect));
  if (expect.deliverableLumaRefs?.length) checks.push(await deliverableLumaCheck(file, expect.deliverableLumaRefs, expect));
  checks.push(await contactSheet(file));
  return { pass: checks.every((c) => c.pass), checks };
}

export async function writeQa(dir: string, report: QaReport): Promise<void> {
  await fs.writeFile(path.join(dir, 'qa.json'), JSON.stringify(report, null, 2));
}
