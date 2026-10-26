import fs from 'node:fs/promises';
import path from 'node:path';
import { run } from '../media/run';
import { probe } from '../media/probe';
import { resolveAsset } from '../media/assets';
import { TV_BT709_TAGS } from '../media/color';
import { finishLoudness } from '../media/prepare';
import { compile, RATIO_SIZE } from '../compile';
import { LAYOUT_TWEEN_S, sceneAspect, sceneFaces, splitFit, type FaceState } from '../compile/layers';
import { punchScaleExpr } from '../compile/punch';
import type { Plan, Ratio } from '../plan';
import { render } from './render';
import { baseEncodeArgs, compositeEncodeArgs, profilePlan, type RenderProfile } from './profiles';

export interface LayeredOpts {
  assetsDir: string;
  workDir: string;
  out: string;
  ratio: Ratio;
  /** x264 CRF of the delivered composite (the base track stays lossless ffv1). Default 10, v5's delivery setting (reel doc §8.1). */
  crf?: number;
  /** Encode speed profile; default 'final' (deliverables). */
  profile?: RenderProfile;
}

export interface LayeredResult {
  /** Lossless footage-only base track (ffv1), kept for the footage luma gate (`QaExpect.lumaFile`). */
  base: string;
}

export const DELIVERY_CRF = 10;

/*
 * Root cause of the old -1.9 luma shift (bisected: already present in the lossless base): the lavfi `color`
 * source is untagged, and this ffmpeg's overlay negotiates the colour space of both inputs, silently converting
 * the BT.709 footage to the untagged (BT.601) matrix. Tagging every compositing input BT.709/TV removes it.
 */
const BT709_TV = 'setparams=range=tv:colorspace=bt709:color_primaries=bt709:color_trc=bt709';

function n(x: number): string { return Number(x.toFixed(6)).toString(); }

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

export type ClipSizes = Record<string, { width: number; height: number }>;

/**
 * Per-shot filter chain: trim, optional per-frame scale+crop punch-in (no zoompan), shift to timeline, layout scale.
 * The punch scales the clip up and crops it back to the clip's own size `clip` (not the output frame: a shot whose
 * `aspect` differs from the frame would be cut to the wrong shape), centred.
 */
function shotChain(idx: number, label: string, sh: Plan['scenes'][number]['shots'][number], clip: { width: number; height: number }, punchIns: boolean, place?: { scale: string }): string {
  const dur = sh.to - sh.from;
  const f = [`trim=start=${n(sh.from)}:duration=${n(dur)}`, 'setpts=PTS-STARTPTS'];
  // punch-ins only when the "soft punch-ins" card is ticked (spec §6 "Never zoom into the face")
  if (punchIns && sh.punch !== undefined && sh.punch < sh.at + dur) {
    // the same v5 spring as the HTML layer (compile/punch.ts), evaluated per frame for the rest of the shot
    const s = punchScaleExpr(sh.punch - sh.at);
    f.push(`scale=w='trunc(iw*${s}/2)*2':h='trunc(ih*${s}/2)*2':eval=frame:flags=bicubic`, `crop=${clip.width}:${clip.height}`);
  }
  f.push(`setpts=PTS+${n(sh.at)}/TB`);
  if (place) f.push(place.scale);
  return `[${idx}:v]${f.join(',')}[${label}]`;
}

/**
 * ffmpeg arguments of the base track: shots on black at their `at` times, no colour filters, working-clip encode rules.
 * `sizes`: each punched shot's clip size by `src` (`buildBase` probes them); without it a punched shot must be a
 * working clip at the output size (no `aspect`, or the frame's).
 */
export function baseArgs(plan: Plan, o: LayeredOpts, w: number, h: number, out: string, sizes?: ClipSizes): string[] {
  const faces = sceneFaces(plan, w, h);
  const shots = plan.scenes.flatMap((sc, si) => sc.shots.map((sh) => ({
    ...sh,
    place: placement({ face: faces[si], facePos: sc.facePos ?? { x: 0.5, y: 0.5 }, fit: sc.layout === 'split' ? splitFit(sceneAspect(sc, w, h)) : 'cover' }, w, h),
  })));
  const args = ['-y', '-v', 'error', '-f', 'lavfi', '-i', `color=c=black:s=${w}x${h}:r=${plan.fps}:d=${n(plan.duration)},format=yuv420p,${BT709_TV}`];
  for (const sh of shots) args.push('-i', resolveAsset(sh.src, o.assetsDir));
  const parts: string[] = [];
  let cur = '0:v';
  shots.forEach((sh, i) => {
    let clip = sizes?.[sh.src];
    if (!clip && plan.selection.punchIns && sh.punch !== undefined) {
      if (sh.aspect !== undefined && Math.abs(sh.aspect - w / h) > 1e-3) {
        throw new Error(`baseArgs: punch-in on ${sh.src} (aspect ${sh.aspect}) needs the clip's size (sizes) to crop back to`);
      }
    }
    parts.push(shotChain(i + 1, `s${i}`, sh, clip ?? { width: w, height: h }, plan.selection.punchIns, sh.place));
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
    ...baseEncodeArgs(o.profile ?? 'final'), out,
  );
  return args;
}

async function buildBase(plan: Plan, o: LayeredOpts, w: number, h: number, out: string): Promise<void> {
  const sizes: ClipSizes = {};
  for (const sh of plan.scenes.flatMap((s) => s.shots)) {
    if (sh.punch === undefined || sizes[sh.src]) continue;
    const p = await probe(resolveAsset(sh.src, o.assetsDir));
    sizes[sh.src] = { width: p.width, height: p.height };
  }
  await run('ffmpeg', baseArgs(plan, o, w, h, out, sizes), { timeoutMs: 30 * 60 * 1000 });
}

/** Voice + music + SFX mixed by ffmpeg from the plan (levels from the cues), exactly plan.duration long. */
async function buildAudio(plan: Plan, o: LayeredOpts, out: string): Promise<void> {
  const D = n(plan.duration);
  const args = ['-y', '-v', 'error', '-f', 'lavfi', '-i', `anullsrc=r=48000:cl=stereo:d=${D}`];
  const parts: string[] = [];
  const labels = ['[0:a]'];
  let i = 1;
  if (plan.voice) {
    args.push('-i', resolveAsset(plan.voice.src, o.assetsDir));
    parts.push(`[${i}:a]aresample=48000,aformat=channel_layouts=stereo,atrim=0:${D}[a${i}]`);
    labels.push(`[a${i}]`); i++;
  }
  if (plan.music) {
    const m = plan.music;
    args.push('-i', resolveAsset(m.src, o.assetsDir));
    const fo = Math.max(0, plan.duration - m.fadeOut);
    parts.push(
      `[${i}:a]aresample=48000,aformat=channel_layouts=stereo,atrim=start=${n(m.mediaStart)}:duration=${D},asetpts=PTS-STARTPTS,` +
      `volume=${n(m.volume)},afade=t=out:st=${n(fo)}:d=${n(m.fadeOut)}[a${i}]`,
    );
    labels.push(`[a${i}]`); i++;
  }
  for (const c of plan.sfx) {
    args.push('-i', resolveAsset(c.file, o.assetsDir));
    const ms = Math.round(c.at * 1000);
    parts.push(`[${i}:a]aresample=48000,aformat=channel_layouts=stereo,volume=${n(c.volume)},adelay=${ms}|${ms}[a${i}]`);
    labels.push(`[a${i}]`); i++;
  }
  parts.push(`${labels.join('')}amix=inputs=${labels.length}:duration=first:normalize=0,atrim=0:${D}[aout]`);
  args.push('-filter_complex', parts.join(';'), '-map', '[aout]', '-t', D, '-c:a', 'pcm_s16le', '-ar', '48000', out);
  await run('ffmpeg', args, { timeoutMs: 10 * 60 * 1000 });
}

/**
 * Primary render path (the spikes' decision): footage encoded as a plain base track, HyperFrames renders cards/captions as a ProRes 4444
 * alpha overlay, ffmpeg composites (`overlay=format=auto`, yuva420p so base luma never round-trips through RGB).
 */
export async function renderLayered(input: Plan, o: LayeredOpts): Promise<LayeredResult> {
  const plan = profilePlan(input, o.profile ?? 'final');
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
  await render(proj, ovl, { fps: plan.fps, format: 'mov', profile: o.profile ?? 'final' });

  await run('ffmpeg', compositeArgs({ base, overlay: ovl, mix, out: comp, duration: plan.duration, profile: o.profile ?? 'final', crf: o.crf }), { timeoutMs: 30 * 60 * 1000 });

  await finishLoudness(comp, o.out, { I: -14, TP: -1.5 });
  return { base };
}

/** ffmpeg args compositing the alpha overlay onto the base track with the mixed audio (yuva420p: base luma never round-trips through RGB). */
export function compositeArgs(o: { base: string; overlay: string; mix: string; out: string; duration: number; profile: RenderProfile; crf?: number }): string[] {
  return [
    '-y', '-v', 'error', '-i', o.base, '-i', o.overlay, '-i', o.mix,
    '-filter_complex', `[1:v]${BT709_TV},format=yuva420p[ov];[0:v][ov]overlay=format=auto:eof_action=pass,format=yuv420p[v]`,
    '-map', '[v]', '-map', '2:a', '-t', n(o.duration),
    ...compositeEncodeArgs(o.profile, o.crf),
    '-c:a', 'pcm_s16le', o.out,
  ];
}
