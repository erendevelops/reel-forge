import { z } from 'zod';
import type { Card } from '../../plan';
import { type CardTemplate, type CompileContext, esc, num, sz, tlFromTo, tlSet } from '../types';
import { GREEN, INK, MUTED, cardInOut, regionClip, talkingCss } from './talking';

const Params = z.object({
  items: z.array(z.object({ label: z.string().min(1), at: z.number().finite().nonnegative() })).min(1),
});

const TICK_POP = { duration: 0.35, ease: 'back.out(1.7)' };
const CHECK_SVG =
  '<svg viewBox="0 0 24 24" width="100%" height="100%"><polyline points="5,12.5 10,17.5 19,7" fill="none" stroke="#FFFFFF" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/**
 * Checklist on a white card: every row is visible from the card start (label muted, box empty); on its `at` the
 * tick pops (scale 0 → 1), the box fills green and the label turns ink. Items with `at < start` render ticked.
 */
export const checklist: CardTemplate = {
  type: 'checklist',
  params: Params,
  render(card: Card, id: string, ctx: CompileContext) {
    const p = Params.parse(card.params);
    const done = (at: number) => at < card.start;
    const box = sz(ctx, 64);
    const rows = p.items
      .map((it, i) => {
        const d = done(it.at);
        return (
          `<div id="${id}-i${i + 1}" class="ck-row">` +
          `<span class="ck-box" style="width: ${num(box)}px; height: ${num(box)}px; background: ${d ? GREEN : '#FFFFFF'};${d ? ` border-color: ${GREEN};` : ''}">` +
          `<span class="ck-tick" style="opacity: ${d ? 1 : 0};">${CHECK_SVG}</span></span>` +
          `<span class="ck-label" style="color: ${d ? INK : MUTED};">${esc(it.label)}</span></div>`
        );
      })
      .join('');
    const tl = cardInOut(`#${id} .tk-card`, card, ctx);
    p.items.forEach((it, i) => {
      if (done(it.at)) return;
      const row = `#${id}-i${i + 1}`;
      tl.push(tlFromTo(`${row} .ck-tick`, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, ...TICK_POP }, it.at));
      tl.push(tlSet(`${row} .ck-box`, { background: GREEN, borderColor: GREEN }, it.at));
      tl.push(tlSet(`${row} .ck-label`, { color: INK }, it.at));
    });
    return {
      html: regionClip(id, card, ctx, 'checklist', `<div class="tk-card">${rows}</div>`),
      css: [
        talkingCss(ctx),
        `.checklist .ck-row { display: flex; align-items: center; gap: ${num(sz(ctx, 26))}px; margin: ${num(sz(ctx, 14))}px 0; }`,
        `.checklist .ck-box { position: relative; flex-shrink: 0; border-radius: ${num(sz(ctx, 18))}px; border: ${num(sz(ctx, 5))}px solid #D9D4C7; }`,
        `.checklist .ck-tick { position: absolute; left: 8%; top: 8%; width: 84%; height: 84%; }`,
        `.checklist .ck-label { font-weight: 800; font-size: ${num(sz(ctx, 58))}px; line-height: 1.2; white-space: nowrap; }`,
      ].join('\n'),
      timeline: tl.join('\n'),
    };
  },
};
