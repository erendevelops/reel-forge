import fs from 'node:fs/promises';
import { run } from '../media/run';
import type { Layout, Plan, Scene, Shot } from '../plan';
import { type CompileContext, type Fragment, type Region, num, sz, tlFromTo, vars } from './types';
import { PUNCH, PUNCH_SETTLE, punchEaseJs } from './punch';

export function allShots(plan: Plan): Shot[] {
  return plan.scenes.flatMap((s) => s.shots);
}

/** Talking-head layouts (onur.builds reel): beige graphics panel, face as a rounded card at the bottom. */
export const LAYOUT_BG = '#F7F3EA';
const FACE_RADIUS = 28;
/** Widest the split face card may be, as a fraction of the frame width. */
const FACE_MAX_WIDTH = 0.92;
const LAYOUT_TWEEN = { duration: 0.4, ease: 'expo.out' };

/** Position is a transform (x/y: sub-pixel, no layout snapping under frame seeking); size is width/height. */
export type FaceState = { x: number; y: number; width: number; height: number; borderRadius: number; opacity: number };

const sceneLayout = (s: Scene): Layout => s.layout ?? 'full-face';

/** The scene's source aspect (w/h): its first shot's `aspect`, else the frame's (a working clip at output size). */
export const sceneAspect = (s: Scene, width: number, height: number): number => s.shots[0]?.aspect ?? width / height;

/** Graphics region of a layout: `split` keeps graphics in the top 50%; every other layout uses the whole frame. */
export function layoutRegion(layout: Layout | undefined, ctx: CompileContext): Region {
  if (layout === 'split') return { x: 0, y: 0, w: ctx.width, h: ctx.height / 2 };
  // explicit full-face: cards sit in the band below the captions so they never cover the face
  if (layout === 'full-face') {
    const top = Math.round(FULL_FACE_CARD_TOP * ctx.height);
    return { x: 0, y: top, w: ctx.width, h: ctx.height - top };
  }
  return { x: 0, y: 0, w: ctx.width, h: ctx.height };
}

/** Top of the full-face card band as a fraction of height (below the caption block at 0.677). */
export const FULL_FACE_CARD_TOP = 0.78;

/**
 * The face card rectangle (px) of a layout in a W×H frame. `split`: the largest box of the source's own `aspect`
 * (w/h, default the frame's) that fits the bottom half (92% wide at most, 40 px gaps), centred there — the whole
 * source frame shows, never a crop into the face (spec §6 "Never zoom into the face"). Other layouts: full frame.
 */
export function faceRect(layout: Layout, width: number, height: number, aspect = width / height): { x: number; y: number; w: number; h: number } {
  if (layout === 'split') {
    const gap = (40 * Math.min(width, height)) / 1080;
    const maxH = height / 2 - 2 * gap;
    const w = Math.min(FACE_MAX_WIDTH * width, maxH * aspect);
    const h = w / aspect;
    return { x: (width - w) / 2, y: height / 2 + gap + (maxH - h) / 2, w, h };
  }
  return { x: 0, y: 0, w: width, h: height };
}

/** `prev` is the face geometry before this layout; `full-graphics` keeps it and only hides the face. `aspect`: the source's w/h. */
export function faceState(layout: Layout, ctx: { width: number; height: number }, prev: FaceState | undefined, aspect?: number): FaceState {
  const full = { x: 0, y: 0, width: ctx.width, height: ctx.height, borderRadius: 0, opacity: 1 };
  if (layout === 'split') {
    const r = faceRect('split', ctx.width, ctx.height, aspect);
    return { x: r.x, y: r.y, width: r.w, height: r.h, borderRadius: FACE_RADIUS, opacity: 1 };
  }
  if (layout === 'full-graphics') return { ...(prev ?? full), opacity: 0 };
  return full;
}

const bgOpacity = (layout: Layout) => (layout === 'split' || layout === 'full-graphics' ? 1 : 0);
const same = (a: FaceState, b: FaceState) => (Object.keys(a) as (keyof FaceState)[]).every((k) => num(a[k]) === num(b[k]));

/**
 * Layout switching: the first scene's layout is the inline start state; every later change tweens the face
 * wrapper (`#face`) and the beige panel (`#layout-bg`) over 0.4 s `expo.out` from the scene start.
 */
function renderLayouts(plan: Plan, ctx: CompileContext): { faceStyle: string; bg: string; css: string; timeline: string } {
  const tl: string[] = [];
  const asp = (s: Scene) => sceneAspect(s, ctx.width, ctx.height);
  let face = faceState(sceneLayout(plan.scenes[0]), ctx, undefined, asp(plan.scenes[0]));
  let bg = bgOpacity(sceneLayout(plan.scenes[0]));
  const init = face;
  const initBg = bg;
  for (const s of plan.scenes.slice(1)) {
    const next = faceState(sceneLayout(s), ctx, face, asp(s));
    const nextBg = bgOpacity(sceneLayout(s));
    if (!same(face, next)) tl.push(tlFromTo('#face', face, { ...next, ...LAYOUT_TWEEN, immediateRender: false }, s.start));
    if (bg !== nextBg) tl.push(tlFromTo('#layout-bg', { opacity: bg }, { opacity: nextBg, ...LAYOUT_TWEEN, immediateRender: false }, s.start));
    face = next;
    bg = nextBg;
  }
  const usesPanel = plan.scenes.some((s) => bgOpacity(sceneLayout(s)) === 1);
  const faceStyle =
    `transform: translate(${num(init.x)}px, ${num(init.y)}px); width: ${num(init.width)}px; height: ${num(init.height)}px; ` +
    `border-radius: ${num(init.borderRadius)}px; opacity: ${num(init.opacity)};`;
  return {
    faceStyle,
    bg: usesPanel ? `<div id="layout-bg" style="opacity: ${initBg};"></div>` : '',
    css: [
      '#face { position: absolute; left: 0; top: 0; z-index: 1; overflow: hidden; }',
      usesPanel ? `#layout-bg { position: absolute; left: 0; top: 0; width: 100%; height: 100%; z-index: 0; background: ${LAYOUT_BG}; }` : '',
    ].filter(Boolean).join('\n'),
    timeline: tl.join('\n'),
  };
}

/** Face geometry over a scene: `from` (previous scene's state) tweens to `to` over LAYOUT_TWEEN from `start`. */
export type SceneFace = { start: number; from: FaceState; to: FaceState };
export const LAYOUT_TWEEN_S = LAYOUT_TWEEN.duration;
const NL = String.fromCharCode(10);

/** Per-scene face geometry in a W×H frame, exactly as `renderLayouts` tweens `#face` (first scene: no tween). */
export function sceneFaces(plan: Plan, width: number, height: number): SceneFace[] {
  const out: SceneFace[] = [];
  let face: FaceState | undefined;
  for (const s of plan.scenes) {
    const next = faceState(sceneLayout(s), { width, height }, face, sceneAspect(s, width, height));
    out.push({ start: s.start, from: face ?? next, to: next });
    face = next;
  }
  return out;
}

/**
 * Layered path, overlay side of the layouts: the footage (base track) is scaled/placed into the face rect by
 * ffmpeg, and the overlay draws everything around it: `#face-hole` follows the face rect (same tween as `#face`)
 * and paints the beige panel outside its rounded corners via a large box-shadow spread; `#layout-cover` fades the
 * panel over the whole frame while the face is hidden (full-graphics). Full-face scenes leave the frame transparent.
 */
export function renderLayoutMask(plan: Plan, ctx: CompileContext): Fragment {
  if (!plan.scenes.some((s) => sceneLayout(s) === 'split' || sceneLayout(s) === 'full-graphics')) return { html: '', css: '', timeline: '' };
  const faces = sceneFaces(plan, ctx.width, ctx.height);
  const geo = (f: FaceState) => ({ x: f.x, y: f.y, width: f.width, height: f.height, borderRadius: f.borderRadius });
  const tl: string[] = [];
  for (const f of faces.slice(1)) {
    if (!same({ ...f.from, opacity: 0 }, { ...f.to, opacity: 0 })) tl.push(tlFromTo('#face-hole', geo(f.from), { ...geo(f.to), ...LAYOUT_TWEEN, immediateRender: false }, f.start));
    if (f.from.opacity !== f.to.opacity) tl.push(tlFromTo('#layout-cover', { opacity: 1 - f.from.opacity }, { opacity: 1 - f.to.opacity, ...LAYOUT_TWEEN, immediateRender: false }, f.start));
  }
  const i = faces[0].to;
  const spread = 2 * Math.max(ctx.width, ctx.height);
  return {
    html: [
      `<div id="face-hole" style="transform: translate(${num(i.x)}px, ${num(i.y)}px); width: ${num(i.width)}px; height: ${num(i.height)}px; border-radius: ${num(i.borderRadius)}px;"></div>`,
      `<div id="layout-cover" style="opacity: ${num(1 - i.opacity)};"></div>`,
    ].join(NL),
    css: [
      `#face-hole { position: absolute; left: 0; top: 0; z-index: 2; box-shadow: 0 0 0 ${spread}px ${LAYOUT_BG}; }`,
      `#layout-cover { position: absolute; left: 0; top: 0; width: 100%; height: 100%; z-index: 2; background: ${LAYOUT_BG}; }`,
    ].join(NL),
    timeline: tl.join(NL),
  };
}

/**
 * Footage: one muted `<video class="clip">` per shot inside a wrapper the punch-in scales, all inside `#face`.
 * Split scenes show the whole source frame (`object-fit: contain` in a card of the source's aspect); full-frame
 * scenes cover, panned by `facePos` (a pan, never a zoom). Punch-ins only when `selection.punchIns` is ticked.
 */
export function renderFootage(plan: Plan, ctx: CompileContext): Fragment {
  const html: string[] = [];
  const tl: string[] = [];
  const shots = plan.scenes.flatMap((sc) => sc.shots.map((sh) => ({ sh, facePos: sc.facePos, split: sceneLayout(sc) === 'split' })));
  shots.forEach(({ sh, facePos, split }, i) => {
    const id = `shot-${i + 1}`;
    const dur = sh.to - sh.from;
    const pos = split
      ? ' style="object-fit: contain;"'
      : facePos
        ? ` style="object-position: ${num(facePos.x * 100)}% ${num(facePos.y * 100)}%;"`
        : '';
    html.push(
      `<div id="${id}" class="shot">` +
        `<video id="${id}-video" class="clip" muted playsinline data-start="${num(sh.at)}" data-duration="${num(dur)}" ` +
        `data-media-start="${num(sh.from)}" data-track-index="0"${pos} src="${ctx.assetsUrl(sh.src)}"></video></div>`,
    );
    if (sh.punch !== undefined && plan.selection.punchIns) {
      // v5 spring until it settles or the shot ends; the ease is the spring's own time curve (see punch.ts)
      const d = Math.min(PUNCH_SETTLE, sh.at + dur - sh.punch);
      if (d > 0) {
        const to = vars({ scale: 1 + PUNCH.amount, duration: d }).replace(/ \}$/, `, ease: punchEase(${num(d)}) }`);
        tl.push(`tl.fromTo(${JSON.stringify(`#${id}`)}, ${vars({ scale: 1 })}, ${to}, ${num(sh.punch)});`);
      }
    }
  });
  if (tl.length) tl.unshift(punchEaseJs());
  const lay = renderLayouts(plan, ctx);
  return {
    html: [lay.bg, `<div id="face" style="${lay.faceStyle}">`, ...html, '</div>'].filter(Boolean).join('\n'),
    css: [
      lay.css,
      '.shot { position: absolute; left: 0; top: 0; width: 100%; height: 100%; z-index: 1; overflow: hidden; }',
      '.shot video.clip { position: absolute; left: 0; top: 0; width: 100%; height: 100%; object-fit: cover; }',
    ].join('\n'),
    timeline: [lay.timeline, ...tl].filter(Boolean).join('\n'),
  };
}

function audioTag(id: string, a: Record<string, string>, src: string): string {
  const attrs = Object.entries(a)
    .map(([k, v]) => ` data-${k}="${v}"`)
    .join('');
  return `<audio id="${id}" class="clip"${attrs} src="${src}"></audio>`;
}

/** Voice-over spans the whole reel from 0. */
export function renderVoice(plan: Plan, ctx: CompileContext): string {
  if (!plan.voice) return '';
  return audioTag('voice', { start: '0', duration: num(plan.duration), volume: '1', 'track-index': '1' }, ctx.assetsUrl(plan.voice.src));
}

export function renderMusic(plan: Plan, ctx: CompileContext): string {
  const m = plan.music;
  if (!m) return '';
  return audioTag(
    'music',
    {
      start: '0',
      duration: num(plan.duration),
      'media-start': num(m.mediaStart),
      volume: num(m.volume),
      'fade-out': num(m.fadeOut),
      'track-index': '2',
    },
    ctx.assetsUrl(m.src),
  );
}

/** One `<audio>` per cue; `durations[i]` is the cue file's length in seconds. */
export function renderSfx(plan: Plan, ctx: CompileContext, durations: number[]): string {
  return plan.sfx
    .map((c, i) => {
      const d = Math.max(0.001, Math.min(durations[i], plan.duration - c.at));
      return audioTag(
        `sfx-${i + 1}`,
        { start: num(c.at), duration: num(d), volume: num(c.volume), 'track-index': String(10 + i) },
        ctx.assetsUrl(c.file),
      );
    })
    .join('\n');
}

/** Length of a PCM WAV from its header; other formats fall back to ffprobe. */
export async function audioDuration(file: string): Promise<number> {
  const buf = await fs.readFile(file);
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WAVE') {
    let off = 12;
    let byteRate = 0;
    while (off + 8 <= buf.length) {
      const idc = buf.toString('ascii', off, off + 4);
      const size = buf.readUInt32LE(off + 4);
      if (idc === 'fmt ') byteRate = buf.readUInt32LE(off + 16);
      if (idc === 'data' && byteRate > 0) return Math.min(size, buf.length - off - 8) / byteRate;
      off += 8 + size + (size % 2);
    }
  }
  const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]);
  const d = Number(stdout.trim());
  if (!Number.isFinite(d) || d <= 0) throw new Error(`cannot read duration of ${file}`);
  return d;
}
