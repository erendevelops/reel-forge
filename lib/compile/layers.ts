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
const FACE_WIDTH = 0.7;
const LAYOUT_TWEEN = { duration: 0.4, ease: 'expo.out' };

/** Position is a transform (x/y: sub-pixel, no layout snapping under frame seeking); size is width/height. */
type FaceState = { x: number; y: number; width: number; height: number; borderRadius: number; opacity: number };

const sceneLayout = (s: Scene): Layout => s.layout ?? 'full-face';

/** Graphics region of a layout: `split` keeps graphics in the top 50%; every other layout uses the whole frame. */
export function layoutRegion(layout: Layout | undefined, ctx: CompileContext): Region {
  return layout === 'split' ? { x: 0, y: 0, w: ctx.width, h: ctx.height / 2 } : { x: 0, y: 0, w: ctx.width, h: ctx.height };
}

/** `prev` is the face geometry before this layout; `full-graphics` keeps it and only hides the face. */
function faceState(layout: Layout, ctx: CompileContext, prev: FaceState | undefined): FaceState {
  const full = { x: 0, y: 0, width: ctx.width, height: ctx.height, borderRadius: 0, opacity: 1 };
  if (layout === 'split') {
    const gap = sz(ctx, 40);
    const w = FACE_WIDTH * ctx.width;
    return { x: (ctx.width - w) / 2, y: ctx.height / 2 + gap, width: w, height: ctx.height / 2 - 2 * gap, borderRadius: FACE_RADIUS, opacity: 1 };
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
  let face = faceState(sceneLayout(plan.scenes[0]), ctx, undefined);
  let bg = bgOpacity(sceneLayout(plan.scenes[0]));
  const init = face;
  const initBg = bg;
  for (const s of plan.scenes.slice(1)) {
    const next = faceState(sceneLayout(s), ctx, face);
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

/** Footage: one muted `<video class="clip">` per shot inside a wrapper the punch-in scales, all inside `#face`. */
export function renderFootage(plan: Plan, ctx: CompileContext): Fragment {
  const html: string[] = [];
  const tl: string[] = [];
  // the face-aware framing: `object-position` keeps a high or low face inside the (split) face card's crop
  const shots = plan.scenes.flatMap((sc) => sc.shots.map((sh) => ({ sh, facePos: sc.facePos })));
  shots.forEach(({ sh, facePos }, i) => {
    const id = `shot-${i + 1}`;
    const dur = sh.to - sh.from;
    const pos = facePos ? ` style="object-position: ${num(facePos.x * 100)}% ${num(facePos.y * 100)}%;"` : '';
    html.push(
      `<div id="${id}" class="shot">` +
        `<video id="${id}-video" class="clip" muted playsinline data-start="${num(sh.at)}" data-duration="${num(dur)}" ` +
        `data-media-start="${num(sh.from)}" data-track-index="0"${pos} src="${ctx.assetsUrl(sh.src)}"></video></div>`,
    );
    if (sh.punch !== undefined) {
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
