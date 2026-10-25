import type { z } from 'zod';
import type { Card, CardType, Ratio } from '../plan';

/** A piece of the compiled page. `timeline` is JS source of GSAP calls on `tl`, in absolute seconds. */
export type Fragment = { html: string; css: string; timeline: string };

export type CompileContext = {
  width: number;
  height: number;
  fps: number;
  ratio: Ratio;
  /** Maps a plan-relative asset path (e.g. `ext/logo.png`) to the URL used in the page. */
  assetsUrl: (p: string) => string;
  /** Where the scene's graphics live, in px (split layout: the top half). Defaults to the whole frame. */
  region?: Region;
};

export type Region = { x: number; y: number; w: number; h: number };

export const regionOf = (ctx: CompileContext): Region => ctx.region ?? { x: 0, y: 0, w: ctx.width, h: ctx.height };

export type CardTemplate = {
  type: CardType;
  params: z.ZodTypeAny;
  render(card: Card, id: string, ctx: CompileContext): Fragment;
};

export const RATIO_SIZE: Record<Ratio, [number, number]> = {
  '9:16': [1080, 1920],
  '4:5': [1080, 1350],
  '1:1': [1080, 1080],
  '16:9': [1920, 1080],
};

/** The reel's design frame: every reel-doc pixel value is authored against 1080×1920. */
export const DESIGN_W = 1080;
export const DESIGN_H = 1920;

export const YELLOW = '#FFD21F';
export const WHITE = '#FFFFFF';

/** Seconds/pixels rounded to 3 decimals, printed without trailing zeros. Deterministic. */
export function num(n: number): string {
  const r = Number(n.toFixed(3));
  return String(Object.is(r, -0) ? 0 : r);
}

/** Horizontal design px → px of this ratio (fraction of width). */
export const fx = (ctx: CompileContext, px: number) => (px / DESIGN_W) * ctx.width;
/** Vertical design px → px of this ratio (fraction of height). */
export const fy = (ctx: CompileContext, px: number) => (px / DESIGN_H) * ctx.height;
/** Size design px → px; every ratio's short side is 1080, so sizes stay constant. */
export const sz = (ctx: CompileContext, px: number) => (px * Math.min(ctx.width, ctx.height)) / DESIGN_W;

export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** A GSAP vars object literal with stable key order, e.g. `{ opacity: 0, ease: "none" }`. */
export function vars(o: Record<string, number | string | boolean>): string {
  const parts = Object.entries(o).map(([k, v]) => `${k}: ${typeof v === 'number' ? num(v) : JSON.stringify(v)}`);
  return `{ ${parts.join(', ')} }`;
}

export const tlSet = (sel: string, v: Record<string, number | string | boolean>, at: number) =>
  `tl.set(${JSON.stringify(sel)}, ${vars(v)}, ${num(at)});`;

export const tlFromTo = (
  sel: string,
  from: Record<string, number | string | boolean>,
  to: Record<string, number | string | boolean>,
  at: number,
) => `tl.fromTo(${JSON.stringify(sel)}, ${vars(from)}, ${vars(to)}, ${num(at)});`;

/** A timed wrapper (`class="clip"`) for a card or layer. Children animate; the clip itself never does. */
export function clipDiv(id: string, start: number, end: number, cls: string, inner: string, style = ''): string {
  const st = style ? ` style="${style}"` : '';
  return `<div id="${id}" class="clip ${cls}" data-start="${num(start)}" data-duration="${num(end - start)}"${st}>${inner}</div>`;
}
