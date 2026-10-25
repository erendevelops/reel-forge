import type { Card } from '../../plan';
import { StampParams } from '../../plan/card-params';
import { type CardTemplate, type CompileContext, esc, num, sz, tlFromTo } from '../types';
import { RED, regionClip, talkingCss } from './talking';

const Params = StampParams;

const ROTATION = -12;
const SLAM = { duration: 0.3, ease: 'expo.out' };
const OUT = 0.2;

/** Rubber stamp: slams from scale 2 to 1 at −12°, red outline on a white fill so it reads over the face too. */
export const stamp: CardTemplate = {
  type: 'stamp',
  params: Params,
  render(card: Card, id: string, ctx: CompileContext) {
    const p = Params.parse(card.params);
    const sel = `#${id} .st-stamp`;
    const outAt = Math.max(card.start, card.end - OUT);
    return {
      html: regionClip(id, card, ctx, 'stamp', `<div class="st-stamp">${esc(p.text)}</div>`),
      css: [
        talkingCss(ctx),
        `.stamp .st-stamp { opacity: 0; padding: ${num(sz(ctx, 18))}px ${num(sz(ctx, 44))}px; border: ${num(sz(ctx, 10))}px solid ${RED}; border-radius: ${num(sz(ctx, 22))}px; background: rgba(255,255,255,0.94); color: ${RED}; font-family: 'Inter', sans-serif; font-weight: 900; font-size: ${num(sz(ctx, 120))}px; letter-spacing: ${num(sz(ctx, 4))}px; text-transform: uppercase; white-space: nowrap; }`,
      ].join('\n'),
      timeline: [
        tlFromTo(sel, { scale: 2, opacity: 0, rotation: ROTATION }, { scale: 1, opacity: 1, rotation: ROTATION, ...SLAM }, card.start),
        tlFromTo(sel, { opacity: 1 }, { opacity: 0, duration: card.end - outAt, ease: 'power3.in', immediateRender: false }, outAt),
      ].join('\n'),
    };
  },
};
