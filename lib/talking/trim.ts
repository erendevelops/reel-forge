import { run } from '../media/run';
import { probe } from '../media/probe';
import type { Transcript } from '../media/transcribe';

/** A kept range of the source take, in source seconds. */
export type Segment = { from: number; to: number };

export interface TrimOpts {
  /** Pauses longer than this are cut (seconds). Default 0.35. */
  maxGap: number;
  /** Silence left after the last word and before the next one at a cut (seconds). Default 0.08. */
  pad: number;
  /** Source ranges removed whole (bad takes). */
  retakes?: [number, number][];
}

/** Audio joins crossfade over this long; each non-last audio piece is extended by it so A/V stay in sync. */
const XFADE = 0.03;

const r6 = (n: number) => Number(n.toFixed(6));

/**
 * Kept ranges of a take. Words overlapping a retake are dropped; consecutive words stay together while the
 * pause between them is ≤ `maxGap` and no retake lies between them. Each range is padded by `pad`, but never
 * past the midpoint of the pause (so a cut always lands between two words) and never into a retake.
 */
export function planTrims(t: Transcript, o: Partial<TrimOpts> = {}): Segment[] {
  const maxGap = o.maxGap ?? 0.35;
  const pad = o.pad ?? 0.08;
  const retakes = (o.retakes ?? []).map(([a, b]) => [Math.min(a, b), Math.max(a, b)] as [number, number]);
  const inRetake = (s: number, e: number) => retakes.some(([a, b]) => s < b && e > a);
  const words = [...t.words].sort((a, b) => a.start - b.start).filter((w) => !inRetake(w.start, w.end));
  if (!words.length) return [];

  const groups: { start: number; end: number }[] = [];
  for (const w of words) {
    const g = groups[groups.length - 1];
    if (g && w.start - g.end <= maxGap && !inRetake(g.end, w.start)) g.end = Math.max(g.end, w.end);
    else groups.push({ start: w.start, end: w.end });
  }

  return groups.map((g, i) => {
    const prev = groups[i - 1];
    const next = groups[i + 1];
    let from = Math.max(0, g.start - pad, prev ? (prev.end + g.start) / 2 : 0);
    let to = Math.min(g.end + pad, next ? (g.end + next.start) / 2 : Infinity);
    for (const [a, b] of retakes) {
      if (b <= g.start) from = Math.max(from, b);
      if (a >= g.end) to = Math.min(to, a);
    }
    return { from: r6(from), to: r6(to) };
  });
}

/** Word times moved into output time (the kept ranges played back to back); words outside every range are dropped. */
export function remapTimes(t: Transcript, segs: Segment[]): Transcript {
  const words: Transcript['words'] = [];
  for (const w of t.words) {
    let offset = 0;
    for (const s of segs) {
      if (w.start >= s.from && w.start < s.to) {
        words.push({ w: w.w, start: r6(offset + w.start - s.from), end: r6(offset + Math.min(w.end, s.to) - s.from) });
        break;
      }
      offset += s.to - s.from;
    }
  }
  return { language: t.language, words };
}

const n = (x: number) => Number(x.toFixed(6)).toString();

/**
 * Kept ranges snapped to the source frame grid (k / fps). Video `trim` keeps whole frames while audio is
 * sample-exact, so unsnapped boundaries leave each piece up to a frame off and the error accumulates across joins.
 * Callers remap word times with the snapped ranges (`renderTrimmedTake` returns the ones it used).
 */
export function snapSegments(segs: Segment[], fps: number): Segment[] {
  const out: Segment[] = [];
  for (const s of segs) {
    const from = Math.round(s.from * fps);
    const to = Math.round(s.to * fps);
    if (to > from) out.push({ from: r6(from / fps), to: r6(to / fps) });
  }
  return out;
}

/**
 * Plays the kept ranges back to back: hard video cuts (`trim` + `concat`), a 0.03 s `acrossfade` at every audio
 * join. Ranges are snapped to the source frame grid first; the snapped ranges are returned so callers can
 * `remapTimes` with exactly what was rendered. No colour filters; the encode follows the working-clip rules
 * (TV range, BT.709 tags, like prepareClip).
 */
export async function renderTrimmedTake(src: string, segsIn: Segment[], out: string): Promise<Segment[]> {
  const { fps } = await probe(src);
  if (!(fps > 0)) throw new Error(`renderTrimmedTake: cannot read frame rate of ${src}`);
  const segs = snapSegments(segsIn, fps);
  if (!segs.length) throw new Error('renderTrimmedTake: no segments');
  const half = 0.5 / fps;
  const parts: string[] = [];
  segs.forEach((s, i) => {
    // half-frame offsets select exactly the frames k..m-1 of a range [k/fps, m/fps), immune to float rounding
    parts.push(`[0:v]trim=start=${n(Math.max(0, s.from - half))}:end=${n(s.to - half)},setpts=PTS-STARTPTS[v${i}]`);
    // every piece but the last carries XFADE extra so the crossfade overlap doesn't shorten the audio
    const end = i < segs.length - 1 ? s.to + XFADE : s.to;
    parts.push(`[0:a]atrim=start=${n(s.from)}:end=${n(end)},asetpts=PTS-STARTPTS[a${i}]`);
  });
  parts.push(
    `${segs.map((_, i) => `[v${i}]`).join('')}concat=n=${segs.length}:v=1:a=0,` +
      'scale=flags=lanczos:out_range=tv,format=yuv420p[vout]',
  );
  let a = 'a0';
  for (let i = 1; i < segs.length; i++) {
    const lbl = `ax${i}`;
    parts.push(`[${a}][a${i}]acrossfade=d=${XFADE}:c1=tri:c2=tri[${lbl}]`);
    a = lbl;
  }
  const total = segs.reduce((acc, s) => acc + s.to - s.from, 0);
  await run('ffmpeg', [
    '-y', '-v', 'error', '-i', src,
    '-filter_complex', parts.join(';'),
    '-map', '[vout]', '-map', `[${a}]`, '-t', n(total),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '4', '-g', '30',
    '-color_range', 'tv', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
    '-x264-params', 'colorprim=bt709:transfer=bt709:colormatrix=bt709',
    '-c:a', 'aac', '-b:a', '320k', '-ar', '48000',
    out,
  ], { timeoutMs: 30 * 60 * 1000 });
  return segs;
}
