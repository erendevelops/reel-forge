import { z } from 'zod';
import type { Card } from '../../plan';
import { type CardTemplate, type CompileContext, YELLOW, WHITE, clipDiv, esc, fy, num, sz, tlFromTo } from '../types';
import { LogoFraming, TOOL_ICON_CSS, toolIcon } from './icon';

const Params = z.object({
  n: z.number().int().nonnegative(),
  name: z.string().min(1),
  logo: z.string().min(1).optional(),
  ...LogoFraming,
});

/** Spring(damping 12, stiffness 200) on scale 0.6→1 ≈ back.out(2.5) over 0.45 s. */
const IN = { duration: 0.45, ease: 'back.out(2.5)' };
const OUT = 0.17;

/**
 * Tool title card (reel doc §7.3): 140 px logo tile with a 64 px yellow number badge, the name in
 * Inter 900 at 118 px (100 px past 9 characters), letter-spacing −3, `margin-top: -260` inside a flex-centred box
 * (v5 Remotion geometry: the visual centre sits ≈130 px above frame centre).
 */
export const titleCard: CardTemplate = {
  type: 'title-card',
  params: Params,
  render(card: Card, id: string, ctx: CompileContext) {
    const p = Params.parse(card.params);
    const fontPx = p.name.length > 9 ? 100 : 118;
    const badge = sz(ctx, 64);
    const inner =
      `<div class="tc-inner" style="margin-top: ${num(-fy(ctx, 260))}px; gap: ${num(sz(ctx, 26))}px;">` +
      `<div class="tc-icon">${toolIcon(ctx, p.logo, sz(ctx, 140), p.name, p)}` +
      `<div class="tc-badge" style="left: ${num(-sz(ctx, 22))}px; top: ${num(-sz(ctx, 22))}px; width: ${num(badge)}px; height: ${num(badge)}px; border-radius: ${num(badge / 2)}px; font-size: ${num(sz(ctx, 40))}px;">${p.n}</div></div>` +
      `<div class="tc-name" style="letter-spacing: ${num(-sz(ctx, 3))}px; font-size: ${num(sz(ctx, fontPx))}px;">${esc(p.name)}</div>` +
      `</div>`;
    const sel = `#${id} .tc-inner`;
    const outAt = Math.max(card.start, card.end - OUT);
    return {
      html: clipDiv(id, card.start, card.end, 'title-card', inner),
      css: [
        TOOL_ICON_CSS,
        '.title-card { position: absolute; left: 0; top: 0; width: 100%; height: 100%; z-index: 3; display: flex; align-items: center; justify-content: center; }',
        '.title-card .tc-inner { position: relative; display: flex; align-items: center; }',
        '.title-card .tc-icon { position: relative; }',
        `.title-card .tc-badge { position: absolute; display: flex; align-items: center; justify-content: center; background: ${YELLOW}; color: #111111; font-family: 'Inter', sans-serif; font-weight: 900; box-shadow: 0 6px 20px rgba(0,0,0,0.5); }`,
        `.title-card .tc-name { font-family: 'Inter', sans-serif; font-weight: 900; color: ${WHITE}; white-space: nowrap; text-shadow: 0 8px 40px rgba(0,0,0,0.75), 0 3px 8px rgba(0,0,0,0.6); }`,
      ].join('\n'),
      timeline: [
        tlFromTo(sel, { scale: 0.6, opacity: 0 }, { scale: 1, opacity: 1, ...IN }, card.start),
        tlFromTo(sel, { scale: 1, opacity: 1 }, { scale: 1.15, opacity: 0, duration: card.end - outAt, ease: 'power2.in', immediateRender: false }, outAt),
      ].join('\n'),
    };
  },
};
