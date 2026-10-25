import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { run } from './run';
import { probe } from './probe';
import type { CropPath } from '../talking/reframe';

export interface PrepareClipOpts {
  from: number;
  duration: number;
  width: number;
  height: number;
  fps: 30 | 60;
  /** Moving crop window in source pixels / source seconds (from `cropPath`); applied before the scale. */
  crop?: CropPath;
}

const n3 = (x: number) => Number(x.toFixed(3)).toString();

/**
 * `sendcmd` script for a crop path, in clip time (source time − `from`). Samples before `from` collapse into the
 * initial window. The window size is fixed by the first sample; only x/y move.
 */
export function cropCommands(crop: CropPath, from: number): { init: { x: number; y: number; w: number; h: number }; script: string } {
  const sorted = [...crop].sort((a, b) => a.t - b.t);
  let init = sorted[0];
  for (const c of sorted) if (c.t <= from) init = c;
  const lines = sorted.filter((c) => c.t > from).map((c) => `${n3(c.t - from)} crop x ${Math.round(c.x)}, crop y ${Math.round(c.y)};`);
  return { init: { x: Math.round(init.x), y: Math.round(init.y), w: init.w, h: init.h }, script: lines.join('\n') + '\n' };
}

/** Working clip: trimmed [from, from+duration+0.3], optionally reframed by a crop path, BT.709 TV range, audio stripped. */
export async function prepareClip(src: string, out: string, o: PrepareClipOpts): Promise<void> {
  const scale = `scale=${o.width}:${o.height}:flags=lanczos:out_range=tv,fps=${o.fps},format=yuv420p`;
  let vf = scale;
  let cwd: string | undefined;
  if (o.crop?.length) {
    const { init, script } = cropCommands(o.crop, o.from);
    // The command file is referenced by a bare name from a temp cwd, so no path ever needs filtergraph escaping.
    cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'tbd-crop-'));
    await fs.writeFile(path.join(cwd, 'crop.cmd'), script, 'utf8');
    vf = `sendcmd=f=crop.cmd,crop=w=${init.w}:h=${init.h}:x=${init.x}:y=${init.y}:exact=1,${scale}`;
  }
  try {
    await run('ffmpeg', [
      '-y', '-v', 'error',
      '-ss', String(o.from), '-t', String(o.duration + 0.3),
      '-i', path.resolve(src),
      '-an',
      '-vf', vf,
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '4', '-g', '30',
      '-color_range', 'tv', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
      // this ffmpeg build's libx264 drops -color_primaries/-color_trc; the x264 VUI params carry them
      '-x264-params', 'colorprim=bt709:transfer=bt709:colormatrix=bt709',
      path.resolve(out),
    ], { cwd });
  } finally {
    if (cwd) await fs.rm(cwd, { recursive: true, force: true });
  }
}

/** Voice track: loudness-normalised 48 kHz WAV. */
export async function prepareVoice(src: string, out: string): Promise<void> {
  await run('ffmpeg', [
    '-y', '-v', 'error', '-i', src, '-vn',
    '-af', 'loudnorm=I=-15:TP=-1.5:LRA=11',
    '-ar', '48000', '-c:a', 'pcm_s16le',
    out,
  ]);
}

/** Final pass: video stream copied, audio loudness-normalised to target, AAC 320k. */
export async function finishLoudness(
  src: string,
  out: string,
  target: { I: number; TP: number },
): Promise<void> {
  // Measured: a 3.0 s render came out 3.1 s after this pass (audio stream 3.1 s, video 3.0 s).
  // Cause: loudnorm resamples internally and emits trailing samples (plus AAC encoder padding),
  // so the audio runs ~0.1 s past the video. Bounding the output to the source length with -t
  // keeps the deliverable exactly as long as the render. Video is stream-copied, never re-encoded.
  const { duration } = await probe(src);
  await run('ffmpeg', [
    '-y', '-v', 'error', '-i', src,
    '-t', String(duration),
    '-c:v', 'copy',
    '-af', `loudnorm=I=${target.I}:TP=${target.TP}:LRA=11`,
    '-ar', '48000', '-c:a', 'aac', '-b:a', '320k',
    '-movflags', '+faststart',
    out,
  ]);
}

/** Luma stats of the frame at time t after scaling to w x h. */
export async function lumaStats(
  file: string,
  t: number,
  w: number,
  h: number,
): Promise<{ yavg: number; ymin: number; ymax: number }> {
  const { stderr } = await run('ffmpeg', [
    '-v', 'info', '-ss', String(t), '-i', file, '-frames:v', '1',
    '-vf', `scale=${w}:${h},signalstats,metadata=print`,
    '-f', 'null', '-',
  ]);
  const get = (k: string): number => {
    const m = new RegExp('lavfi\\.signalstats\\.' + k + '=(-?[\\d.]+)').exec(stderr);
    if (!m) throw new Error(`signalstats ${k} not found for ${file}`);
    return Number(m[1]);
  };
  return { yavg: get('YAVG'), ymin: get('YMIN'), ymax: get('YMAX') };
}
