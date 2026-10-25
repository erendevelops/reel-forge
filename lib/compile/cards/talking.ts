import type { Card } from '../../plan';
import { type CompileContext, clipDiv, num, regionOf, sz, tlFromTo } from '../types';

/** Talking-head explainer palette (onur.builds reel): white rounded cards, near-black ink, muted secondary text. */
export const INK = '#111111';
export const MUTED = '#8A857A';
export const GREEN = '#16A34A';
export const RED = '#E5322D';

/** Arrive slow, leave fast (prao doc §6): 0.5 s `expo.out` rise in, 0.2 s `power3.in` out. */
const IN = { duration: 0.5, ease: 'expo.out' };
const OUT = 0.2;

/** The card's clip, covering its graphics region; `inner` is centred in it. */
export function regionClip(id: string, card: Card, ctx: CompileContext, cls: string, inner: string): string {
  const r = regionOf(ctx);
  const style = `left: ${num(r.x)}px; top: ${num(r.y)}px; width: ${num(r.w)}px; height: ${num(r.h)}px;`;
  return clipDiv(id, card.start, card.end, `talking ${cls}`, inner, style);
}

/** Entrance/exit of the element `sel` (default the white card) over the card's lifetime. */
export function cardInOut(sel: string, card: Card, ctx: CompileContext): string[] {
  const outAt = Math.max(card.start, card.end - OUT);
  return [
    tlFromTo(sel, { y: sz(ctx, 60), opacity: 0 }, { y: 0, opacity: 1, ...IN }, card.start),
    tlFromTo(sel, { y: 0, opacity: 1 }, { y: -sz(ctx, 30), opacity: 0, duration: card.end - outAt, ease: 'power3.in', immediateRender: false }, outAt),
  ];
}

export function talkingCss(ctx: CompileContext): string {
  return [
    '.talking { position: absolute; z-index: 3; display: flex; align-items: center; justify-content: center; }',
    `.talking .tk-card { background: #FFFFFF; color: ${INK}; border-radius: ${num(sz(ctx, 36))}px; padding: ${num(sz(ctx, 44))}px ${num(sz(ctx, 56))}px; box-shadow: 0 ${num(sz(ctx, 14))}px ${num(sz(ctx, 44))}px rgba(0,0,0,0.14); font-family: 'Inter', sans-serif; }`,
  ].join('\n');
}
