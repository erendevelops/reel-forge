import fs from 'node:fs/promises';
import path from 'node:path';
import { run } from '../media/run';
import { finishLoudness } from '../media/prepare';
import { compile, RATIO_SIZE } from '../compile';
import { allShots } from '../compile/layers';
import type { Plan, Ratio } from '../plan';
import { render } from './render';

export interface LayeredOpts { assetsDir: string; workDir: string; out: string; ratio: Ratio }

/** Same soft punch-in as compile/layers.ts: 1 -> 1.08 over min(1.2 s, remaining), power2.out. */
const PUNCH = { scale: 1.08, duration: 1.2 };

const TV_TAGS = ['-color_range', 'tv', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-x264-params', 'colorprim=bt709:transfer=bt709:colormatrix=bt709'];

/*
 * Root cause of the old -1.9 luma shift (bisected: already present in the lossless base): the lavfi `color`
 * source is untagged, and this ffmpeg's overlay negotiates the colour space of both inputs, silently converting
 * the BT.709 footage to the untagged (BT.601) matrix. Tagging every compositing input BT.709/TV removes it.
 */
const BT709_TV = 'setparams=range=tv:colorspace=bt709:color_primaries=bt709:color_trc=bt709';

function n(x: number): string { return Number(x.toFixed(6)).toString(); }

function resolveAsset(assetsDir: string, rel: string): string {
  return path.join(assetsDir, ...rel.split(/[\\/]/));
}

/** Per-shot filter chain: trim, optional per-frame scale+crop punch-in (no zoompan), shift to timeline. */
function shotChain(idx: number, label: string, sh: Plan['scenes'][number]['shots'][number], w: number, h: number): string {
  const dur = sh.to - sh.from;
  const f = [`trim=start=${n(sh.from)}:duration=${n(dur)}`, 'setpts=PTS-STARTPTS'];
  if (sh.punch !== undefined) {
    const d = Math.min(PUNCH.duration, sh.at + dur - sh.punch);
    if (d > 0) {
      const p = `clip((t-${n(sh.punch - sh.at)})/${n(d)},0,1)`;
      const s = `(1+${n(PUNCH.scale - 1)}*(1-pow(1-${p},2)))`;
      f.push(`scale=w='trunc(iw*${s}/2)*2':h='trunc(ih*${s}/2)*2':eval=frame:flags=bicubic`, `crop=${w}:${h}`);
    }
  }
  f.push(`setpts=PTS+${n(sh.at)}/TB`);
  return `[${idx}:v]${f.join(',')}[${label}]`;
}

/** Base track: shots on black at their `at` times, no colour filters, working-clip encode rules. */
async function buildBase(plan: Plan, o: LayeredOpts, w: number, h: number, out: string): Promise<void> {
  const shots = allShots(plan);
  const args = ['-y', '-v', 'error', '-f', 'lavfi', '-i', `color=c=black:s=${w}x${h}:r=${plan.fps}:d=${n(plan.duration)},format=yuv420p,${BT709_TV}`];
  for (const sh of shots) args.push('-i', resolveAsset(o.assetsDir, sh.src));
  const parts: string[] = [];
  let cur = '0:v';
  shots.forEach((sh, i) => {
    parts.push(shotChain(i + 1, `s${i}`, sh, w, h));
    const last = i === shots.length - 1;
    parts.push(
      `[${cur}][s${i}]overlay=eof_action=pass:format=yuv420:enable='between(t,${n(sh.at)},${n(sh.at + sh.to - sh.from)})'${last ? ',format=yuv420p[vout]' : `[o${i}]`}`,
    );
    cur = `o${i}`;
  });
  if (!shots.length) parts.push('[0:v]null[vout]');
  args.push(
    '-filter_complex', parts.join(';'), '-map', '[vout]', '-an', '-t', n(plan.duration),
    '-c:v', 'ffv1', '-level', '3', '-pix_fmt', 'yuv420p', ...TV_TAGS, out,
  );
  await run('ffmpeg', args, { timeoutMs: 30 * 60 * 1000 });
}

/** Voice + music + SFX mixed by ffmpeg from the plan (levels from the cues), exactly plan.duration long. */
async function buildAudio(plan: Plan, o: LayeredOpts, out: string): Promise<void> {
  const D = n(plan.duration);
  const args = ['-y', '-v', 'error', '-f', 'lavfi', '-i', `anullsrc=r=48000:cl=stereo:d=${D}`];
  const parts: string[] = [];
  const labels = ['[0:a]'];
  let i = 1;
  if (plan.voice) {
    args.push('-i', resolveAsset(o.assetsDir, plan.voice.src));
    parts.push(`[${i}:a]aresample=48000,aformat=channel_layouts=stereo,atrim=0:${D}[a${i}]`);
    labels.push(`[a${i}]`); i++;
  }
  if (plan.music) {
    const m = plan.music;
    args.push('-i', resolveAsset(o.assetsDir, m.src));
    const fo = Math.max(0, plan.duration - m.fadeOut);
    parts.push(
      `[${i}:a]aresample=48000,aformat=channel_layouts=stereo,atrim=start=${n(m.mediaStart)}:duration=${D},asetpts=PTS-STARTPTS,` +
      `volume=${n(m.volume)},afade=t=out:st=${n(fo)}:d=${n(m.fadeOut)}[a${i}]`,
    );
    labels.push(`[a${i}]`); i++;
  }
  for (const c of plan.sfx) {
    args.push('-i', resolveAsset(o.assetsDir, c.file));
    const ms = Math.round(c.at * 1000);
    parts.push(`[${i}:a]aresample=48000,aformat=channel_layouts=stereo,volume=${n(c.volume)},adelay=${ms}|${ms}[a${i}]`);
    labels.push(`[a${i}]`); i++;
  }
  parts.push(`${labels.join('')}amix=inputs=${labels.length}:duration=first:normalize=0,atrim=0:${D}[aout]`);
  args.push('-filter_complex', parts.join(';'), '-map', '[aout]', '-t', D, '-c:a', 'pcm_s16le', '-ar', '48000', out);
  await run('ffmpeg', args, { timeoutMs: 10 * 60 * 1000 });
}

/**
 * Fallback path: footage encoded as a plain base track, HyperFrames renders cards/captions as a ProRes 4444
 * alpha overlay, ffmpeg composites (`overlay=format=auto`, yuva420p so base luma never round-trips through RGB).
 */
export async function renderLayered(plan: Plan, o: LayeredOpts): Promise<void> {
  const [w, h] = RATIO_SIZE[o.ratio];
  await fs.mkdir(o.workDir, { recursive: true });
  const base = path.join(o.workDir, 'base.mkv');
  const mix = path.join(o.workDir, 'mix.wav');
  const proj = path.join(o.workDir, 'overlay-proj');
  const ovl = path.join(o.workDir, 'overlay.mov');
  const comp = path.join(o.workDir, 'composite.mp4');

  await buildBase(plan, o, w, h, base);
  await buildAudio(plan, o, mix);

  // SFX are mixed from the plan above, so the overlay carries none.
  await compile({ ...plan, sfx: [] }, { outDir: proj, assetsDir: o.assetsDir, ratio: o.ratio, overlayOnly: true });
  await render(proj, ovl, { fps: plan.fps, format: 'mov' });

  await run('ffmpeg', [
    '-y', '-v', 'error', '-i', base, '-i', ovl, '-i', mix,
    '-filter_complex', `[1:v]${BT709_TV},format=yuva420p[ov];`+'[0:v][ov]overlay=format=auto:eof_action=pass,format=yuv420p[v]',
    '-map', '[v]', '-map', '2:a', '-t', n(plan.duration),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '4', '-g', '30', '-pix_fmt', 'yuv420p', ...TV_TAGS,
    '-c:a', 'pcm_s16le', comp,
  ], { timeoutMs: 30 * 60 * 1000 });

  await finishLoudness(comp, o.out, { I: -14, TP: -1.5 });
}
