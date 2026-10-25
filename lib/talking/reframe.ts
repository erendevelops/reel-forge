import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { run, RunError } from '../media/run';
import type { Ratio } from '../plan';

/** Face boxes from `tools/face_track.py`: `w`/`h` in source pixels, box values normalised 0–1, `t` in source seconds. */
export type FaceTrack = { w: number; h: number; boxes: { t: number; x: number; y: number; bw: number; bh: number }[] };
/** A crop window per sample, in source pixels. */
export type CropPath = { t: number; x: number; y: number; w: number; h: number }[];

const TOOLS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../tools');
const SCRIPT = path.join(TOOLS, 'face_track.py');
/** MediaPipe BlazeFace short-range model; not committed (see tools/face_track.py). */
export const FACE_MODEL = path.join(TOOLS, 'models', 'blaze_face_short_range.tflite');

const RATIO_AR: Record<Ratio, number> = { '9:16': 9 / 16, '4:5': 4 / 5, '1:1': 1, '16:9': 16 / 9 };

const MARGIN = 0.08;
const MAX_STEP = 0.02;

/** Runs `tools/face_track.py` on a video and returns its track. */
export async function faceTrack(video: string, o: { fps?: number; model?: string } = {}): Promise<FaceTrack> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tbd-face-'));
  const out = path.join(dir, 'track.json');
  const args = [SCRIPT, video, out, '--fps', String(o.fps ?? 10), '--model', o.model ?? FACE_MODEL];
  const env = { ...process.env, PYTHONIOENCODING: 'utf-8' };
  try {
    try {
      await run('python', args, { env });
    } catch (e) {
      if (e instanceof RunError && e.code === -1) await run('python3', args, { env });
      else throw e;
    }
    return JSON.parse(await fs.readFile(out, 'utf8')) as FaceTrack;
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * One axis of the follow: exponential smoothing toward the face centre, then the
 * per-sample step limit, then the minimum shift that keeps the face box (± margin) inside the window (containment
 * wins over the step limit), then the frame edges.
 */
function follow(lo: number[], hi: number[], win: number, span: number, margin: number, smoothing: number): number[] {
  const out: number[] = [];
  const maxStep = Math.floor(MAX_STEP * span);
  let s = 0;
  for (let i = 0; i < lo.length; i++) {
    const target = (lo[i] + hi[i]) / 2 - win / 2;
    s = i === 0 ? target : smoothing * s + (1 - smoothing) * target;
    let x = s;
    if (i > 0) x = clamp(x, out[i - 1] - maxStep, out[i - 1] + maxStep);
    // containment wins over the step limit: move only as far beyond it as keeps the face (± margin) inside
    if (hi[i] - lo[i] + 2 * margin <= win) {
      x = Math.max(x, Math.ceil(hi[i] + margin - win));
      x = Math.min(x, Math.floor(lo[i] - margin));
    }
    x = Math.round(clamp(x, 0, span - win));
    out.push(x);
    s = x;
  }
  return out;
}

/**
 * Crop window per face sample for reframing `src` to `target`: the largest window of the target ratio, following
 * the face with exponential smoothing (default 0.85), keeping the whole face box inside with an 8% margin, and
 * moving at most 2% of the width (height, vertically) per sample unless more is needed to keep the face inside.
 * Integer pixels; even sizes.
 */
export function cropPath(track: FaceTrack, src: { w: number; h: number }, target: Ratio, o: { smoothing?: number } = {}): CropPath {
  const smoothing = o.smoothing ?? 0.85;
  const ar = RATIO_AR[target];
  const even = (v: number) => Math.max(2, Math.floor(v / 2) * 2);
  const w = src.w / src.h > ar ? even(src.h * ar) : even(src.w);
  const h = src.w / src.h > ar ? even(src.h) : even(src.w / ar);
  if (!track.boxes.length) return [{ t: 0, x: Math.round((src.w - w) / 2), y: Math.round((src.h - h) / 2), w, h }];

  const b = track.boxes;
  const xs = follow(b.map((q) => q.x * src.w), b.map((q) => (q.x + q.bw) * src.w), w, src.w, MARGIN * w, smoothing);
  const ys = follow(b.map((q) => q.y * src.h), b.map((q) => (q.y + q.bh) * src.h), h, src.h, MARGIN * h, smoothing);
  return b.map((q, i) => ({ t: q.t, x: xs[i], y: ys[i], w, h }));
}

/** Median face centre of a track (0–1), for a scene's `facePos`; centre when no face was found. */
export function facePosition(track: FaceTrack): { x: number; y: number } {
  if (!track.boxes.length) return { x: 0.5, y: 0.5 };
  const med = (v: number[]) => {
    const s = [...v].sort((a, b) => a - b);
    const m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };
  const r = (v: number) => Number(v.toFixed(4));
  return { x: r(med(track.boxes.map((b) => b.x + b.bw / 2))), y: r(med(track.boxes.map((b) => b.y + b.bh / 2))) };
}
