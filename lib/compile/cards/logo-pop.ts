import type { Card } from '../../plan';
import { LogoPopParams } from '../../plan/card-params';
import { type CardTemplate, type CompileContext, WHITE, clipDiv, esc, fx, fy, num, sz, tlFromTo } from '../types';

const Params = LogoPopParams;

/** Spring(damping 11, stiffness 180) on scale 0→1 ≈ back.out(2.5) over 0.6 s. */
const POP = { duration: 0.6, ease: 'back.out(2.5)' };
const DEFAULT_ROT = 5;

/** The 1-based index of this card among its scene's logo pops, from the compiler's `…-<k>` id. */
function indexFromId(id: string): number {
  const m = id.match(/-(\d+)$/);
  return m ? Number(m[1]) : 1;
}

/**
 * Hook pop card (reel doc §7.3): 6 px white border, 26 px radius, scale 0→1 with a ±4–6° rotation
 * and a 0.1 s opacity ramp. Without `rot` the sign alternates by index (−, +, −, …): no randomness.
 * `left`/`top` are 1080×1920 design px and scale as fractions of the frame.
 */
export const logoPop: CardTemplate = {
  type: 'logo-pop',
  params: Params,
  render(card: Card, id: string, ctx: CompileContext) {
    const p = Params.parse(card.params);
    const rot = p.rot ?? (indexFromId(id) % 2 === 1 ? -DEFAULT_ROT : DEFAULT_ROT);
    const bg = p.bg ?? (p.fit === 'contain' ? '#121417' : WHITE);
    const bare = bg === 'transparent';
    const pad = p.fit === 'contain' && !bare ? sz(ctx, 14) : 0;
    const style =
      `left: ${num(fx(ctx, p.left))}px; top: ${num(fy(ctx, p.top))}px; width: ${num(sz(ctx, p.width))}px; ` +
      `height: ${num(sz(ctx, p.height))}px; border-radius: ${num(sz(ctx, 26))}px; ${bare ? 'border: none; box-shadow: none; overflow: visible;' : `border: ${num(sz(ctx, 6))}px solid ${WHITE};`} background: ${esc(bg)};`;
    const img = `<img src="${esc(ctx.assetsUrl(p.img))}" alt="" style="object-fit: ${p.fit}; padding: ${num(pad)}px;${bare ? ' filter: drop-shadow(0 12px 30px rgba(0,0,0,0.55));' : ''}">`;
    const sel = `#${id} .lp-card`;
    return {
      html: clipDiv(id, card.start, card.end, 'logo-pop', `<div class="lp-card" style="${style}">${img}</div>`),
      css: [
        '.logo-pop { position: absolute; left: 0; top: 0; width: 100%; height: 100%; z-index: 2; }',
        '.logo-pop .lp-card { position: absolute; overflow: hidden; box-sizing: border-box; box-shadow: 0 24px 60px rgba(0,0,0,0.55); }',
        '.logo-pop .lp-card img { display: block; width: 100%; height: 100%; box-sizing: border-box; }',
      ].join('\n'),
      timeline: [
        tlFromTo(sel, { scale: 0, rotation: 0 }, { scale: 1, rotation: rot, ...POP }, card.start),
        tlFromTo(sel, { opacity: 0 }, { opacity: 1, duration: 0.1, ease: 'none' }, card.start),
      ].join('\n'),
    };
  },
};
