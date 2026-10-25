import fs from 'node:fs/promises';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { run } from '../media/run';
import { finishLoudness } from '../media/prepare';
import { compile, RATIO_SIZE } from '../compile';
import { LAYOUT_TWEEN_S, sceneFaces, type FaceState } from '../compile/layers';
import { punchScaleExpr } from '../compile/punch';
import type { Plan, Ratio } from '../plan';
import { render } from './render';

export interface LayeredOpts {
  assetsDir: string;
  workDir: string;
  out: string;
  ratio: Ratio;
  /** x264 CRF of the delivered composite (the base track stays lossless ffv1). Default 10, v5's delivery setting (reel doc §8.1). */
  crf?: number;
}

export interface LayeredResult {
  /** Lossless footage-only base track (ffv1), kept for the footage luma gate (`QaExpect.lumaFile`). */
  base: string;
}

export const DELIVERY_CRF = 10;

const TV_TAGS = ['-color_range', 'tv', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-x264-params', 'colorprim=bt709:transfer=bt709:colormatrix=bt709'];

/*
 * Root cause of the old -1.9 luma shift (bisected: already present in the lossless base): the lavfi `color`
 * source is untagged, and this ffmpeg's overlay negotiates the colour space of both inputs, silently converting
 * the BT.709 footage to the untagged (BT.601) matrix. Tagging every compositing input BT.709/TV removes it.
 */
const BT709_TV = 'setparams=range=tv:colorspace=bt709:color_primaries=bt709:color_trc=bt709';

function n(x: number): string { return Number(x.toFixed(6)).toString(); }

/** Bundled assets (CC0 SFX) in the repo's `assets/`: a plan's `sfx/...` resolves there if `assetsDir` lacks it, as in compile. */
const BUNDLED_ASSETS = fileURLToPath(new URL('../../assets/', import.meta.url));

function resolveAsset(assetsDir: string, rel: string): string {
  const parts = rel.split(/[\\/]/);
  const own = path.join(assetsDir, ...parts);
  if (existsSync(own)) return own;
  const bundled = path.join(BUNDLED_ASSETS, ...parts);
  return existsSync(bundled) ? bundled : own;
}

type ShotPlace = { face: { start: number; from: FaceState; to: FaceState }; facePos: { x: number; y: number }; fit: 'cover' | 'contain' };

const isFull = (f: FaceState, w: number, h: number) => f.x === 0 && f.y === 0 && f.width === w && f.height === h;

/**
 * Layout placement (the HTML `#face` + the shot's object-fit), per frame in timeline time t: the face rect tweens
 * from → to with GSAP expo.out over the layout tween. `contain` (split: the card has the source's aspect) scales the
 * whole source frame into it, centred — no crop into the face; `cover` fills it, panned by facePos. Scales are from
 * the clip's own size (iw/ih). Returns the scale filter and the overlay x/y expressions, or none for a full-frame face.
 */
function placement(p: ShotPlace, W: number, H: number): { scale: string; x: string; y: string } | undefined {
  const { from: a, to: b, start } = p.face;
  if (isFull(a, W, H) && isFull(b, W, H)) return undefined;
  const e = `if(gte(t-${n(start)},${LAYOUT_TWEEN_S}),1,if(lte(t,${n(start)}),0,1-pow(2,-10*(t-${n(start)})/${LAYOUT_TWEEN_S})))`;
  const lerp = (u: number, v: number) => (u === v ? n(u) : `(${n(u)}+(${n(v - u)})*${e})`);
  const rx = lerp(a.x, b.x), ry = lerp(a.y, b.y), rw = lerp(a.width, b.width), rh = lerp(a.height, b.height);
  const s = `${p.fit === 'contain' ? 'min' : 'max'}(${rw}/iw,${rh}/ih)`;
  const pos = p.fit === 'contain' ? { x: 0.5, y: 0.5 } : p.facePos;
  return {
    scale: `scale=w='trunc(iw*${s}/2)*2':h='trunc(ih*${s}/2)*2':eval=frame:flags=lanczos`,
    x: `${rx}+(${rw}-overlay_w)*${n(pos.x)}`,
    y: `${ry}+(${rh}-overlay_h)*${n(pos.y)}`,
  };
}

/** Per-shot filter chain: trim, optional per-frame scale+crop punch-in (no zoompan), shift to timeline, layout scale. */
function shotChain(idx: number, label: string, sh: Plan['scenes'][number]['shots'][number], w: number, h: number, punchIns: boolean, place?: { scale: string }): string {
  const dur = sh.to - sh.from;
  const f = [`trim=start=${n(sh.from)}:duration=${n(dur)}`, 'setpts=PTS-STARTPTS'];
  // punch-ins only when the "soft punch-ins" card is ticked (spec §6 "Never zoom into the face")
  if (punchIns && sh.punch !== undefined && sh.punch < sh.at + dur) {
    // the same v5 spring as the HTML layer (compile/punch.ts), evaluated per frame for the rest of the shot
    const s = punchScaleExpr(sh.punch - sh.at);
    f.push(`scale=w='trunc(iw*${s}/2)*2':h='trunc(ih*${s}/2)*2':eval=frame:flags=bicubic`, `crop=${w}:${h}`);
  }
  f.push(`setpts=PTS+${n(sh.at)}/TB`);
  if (place) f.push(place.scale);
  return `[${idx}:v]${f.join(',')}[${label}]`;
}

/** ffmpeg arguments of the base track: shots on black at their `at` times, no colour filters, working-clip encode rules. */
export function baseArgs(plan: Plan, o: LayeredOpts, w: number, h: number, out: string): string[] {
  const faces = sceneFaces(plan, w, h);
  const shots = plan.scenes.flatMap((sc, si) => sc.shots.map((sh) => ({
    ...sh,
    place: placement({ face: faces[si], facePos: sc.facePos ?? { x: 0.5, y: 0.5 }, fit: sc.layout === 'split' ? 'contain' : 'cover' }, w, h),
  })));
  const args = ['-y', '-v', 'error', '-f', 'lavfi', '-i', `color=c=black:s=${w}x${h}:r=${plan.fps}:d=${n(plan.duration)},format=yuv420p,${BT709_TV}`];
  for (const sh of shots) args.push('-i', resolveAsset(o.assetsDir, sh.src));
  const parts: string[] = [];
  let cur = '0:v';
  shots.forEach((sh, i) => {
    parts.push(shotChain(i + 1, `s${i}`, sh, w, h, plan.selection.punchIns, sh.place));
    const last = i === shots.length - 1;
    const pos = sh.place ? `:x='${sh.place.x}':y='${sh.place.y}':eval=frame` : '';
    parts.push(
      `[${cur}][s${i}]overlay=eof_action=pass:format=yuv420${pos}:enable='between(t,${n(sh.at)},${n(sh.at + sh.to - sh.from)})'${last ? ',format=yuv420p[vout]' : `[o${i}]`}`,
    );
    cur = `o${i}`;
  });
  if (!shots.length) parts.push('[0:v]null[vout]');
  args.push(
    '-filter_complex', parts.join(';'), '-map', '[vout]', '-an', '-t', n(plan.duration),
    '-c:v', 'ffv1', '-level', '3', '-pix_fmt', 'yuv420p', ...TV_TAGS, out,
  );
  return args;
}

async function buildBase(plan: Plan, o: LayeredOpts, w: number, h: number, out: string): Promise<void> {
  await run('ffmpeg', baseArgs(plan, o, w, h, out), { timeoutMs: 30 * 60 * 1000 });
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
export async function renderLayered(plan: Plan, o: LayeredOpts): Promise<LayeredResult> {
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
    '-c:v', 'libx264', '-preset', 'slow', '-crf', String(o.crf ?? DELIVERY_CRF), '-g', '30', '-pix_fmt', 'yuv420p', ...TV_TAGS,
    '-c:a', 'pcm_s16le', comp,
  ], { timeoutMs: 30 * 60 * 1000 });

  await finishLoudness(comp, o.out, { I: -14, TP: -1.5 });
  return { base };
}
