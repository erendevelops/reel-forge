import type { Card } from '../../plan';
import { TypedTitleParams } from '../../plan/card-params';
import { type CardTemplate, type CompileContext, esc, num, regionOf, sz, tlFromTo, tlSet } from '../types';
import { INK, MUTED, cardInOut, regionClip, talkingCss } from './talking';

const Params = TypedTitleParams;

const LEAD = 0.2;
const CHAR = 0.06;

/**
 * Typed title: one absolutely stacked state per character (state k shows the first k characters), all hidden in
 * the HTML. Each keypress is a pair of `tl.set`s (hide the previous state, show the next). Never a `fromTo` on the
 * states: GSAP renders a fromTo's start values immediately, which showed every state at frame 0 (prao doc bug).
 */
export const typedTitle: CardTemplate = {
  type: 'typed-title',
  params: Params,
  render(card: Card, id: string, ctx: CompileContext) {
    const p = Params.parse(card.params);
    const chars = Array.from(p.text);
    const step = Math.max(0.02, Math.min(CHAR, (card.end - card.start - LEAD - 0.6) / chars.length));
    const font = Math.min(sz(ctx, 96), (regionOf(ctx).w * 0.8) / (0.58 * chars.length));
    const tl = cardInOut(`#${id} .tk-card`, card, ctx);
    if (p.label) tl.push(tlFromTo(`#${id} .tt-label`, { opacity: 0, y: sz(ctx, 12) }, { opacity: 1, y: 0, duration: 0.4, ease: 'expo.out' }, card.start + 0.1));
    const states = chars.map((_, i) => {
      const k = i + 1;
      const at = card.start + LEAD + i * step;
      if (k > 1) tl.push(tlSet(`#${id}-s${k - 1}`, { opacity: 0 }, at));
      tl.push(tlSet(`#${id}-s${k}`, { opacity: 1 }, at));
      return `<span id="${id}-s${k}" class="tt-state" style="opacity: 0;">${esc(chars.slice(0, k).join(''))}</span>`;
    });
    const label = p.label ? `<div class="tt-label">${esc(p.label)}</div>` : '';
    const box = `<div class="tt-box" data-layout-allow-overlap style="font-size: ${num(font)}px;"><span class="tt-sizer">${esc(p.text)}</span>${states.join('')}</div>`;
    return {
      html: regionClip(id, card, ctx, 'typed-title', `<div class="tk-card">${label}${box}</div>`),
      css: [
        talkingCss(ctx),
        `.typed-title .tt-label { opacity: 0; font-weight: 700; font-size: ${num(sz(ctx, 36))}px; color: ${MUTED}; margin-bottom: ${num(sz(ctx, 12))}px; text-transform: uppercase; letter-spacing: ${num(sz(ctx, 3))}px; }`,
        `.typed-title .tt-box { position: relative; font-family: 'Inter', sans-serif; font-weight: 900; color: ${INK}; line-height: 1.15; white-space: pre; }`,
        '.typed-title .tt-sizer { visibility: hidden; }',
        '.typed-title .tt-state { position: absolute; left: 0; top: 0; }',
      ].join('\n'),
      timeline: tl.join('\n'),
    };
  },
};
