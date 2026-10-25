import { z } from 'zod';
import type { Card } from '../../plan';
import { type CardTemplate, type CompileContext, esc, num, regionOf, sz, tlFromTo } from '../types';
import { INK, MUTED, cardInOut, regionClip, talkingCss } from './talking';

const Params = z.object({
  bars: z.array(z.object({ label: z.string().min(1), value: z.number().finite().nonnegative() })).min(1),
});

const GROW = { duration: 0.7, ease: 'expo.out' };
const LEAD = 0.15;
const STAGGER = 0.08;

/** Vertical bar chart on a white card: bar heights are value / max; bars grow from the baseline left to right. */
export const barChart: CardTemplate = {
  type: 'bar-chart',
  params: Params,
  render(card: Card, id: string, ctx: CompileContext) {
    const p = Params.parse(card.params);
    const max = Math.max(...p.bars.map((b) => b.value)) || 1;
    const r = regionOf(ctx);
    const trackH = Math.min(sz(ctx, 520), r.h * 0.45);
    const barW = Math.min(sz(ctx, 150), (r.w * 0.7) / p.bars.length - sz(ctx, 24));
    const tl = cardInOut(`#${id} .tk-card`, card, ctx);
    const bars = p.bars
      .map((b, i) => {
        const bid = `${id}-b${i + 1}`;
        const at = card.start + LEAD + i * STAGGER;
        const pct = (b.value / max) * 100;
        tl.push(tlFromTo(`#${bid} .bc-fill`, { scaleY: 0 }, { scaleY: 1, ...GROW }, at));
        tl.push(tlFromTo(`#${bid} .bc-val`, { opacity: 0, y: sz(ctx, 16) }, { opacity: 1, y: 0, duration: 0.4, ease: 'expo.out' }, at + 0.25));
        return (
          `<div id="${bid}" class="bc-bar" style="width: ${num(barW)}px;">` +
          `<div class="bc-track" style="height: ${num(trackH)}px;"><div class="bc-fill" style="height: ${num(pct)}%;"></div>` +
          `<div class="bc-val" style="bottom: ${num((pct / 100) * trackH + sz(ctx, 10))}px;">${esc(num(b.value))}</div></div>` +
          `<div class="bc-label">${esc(b.label)}</div></div>`
        );
      })
      .join('');
    return {
      html: regionClip(id, card, ctx, 'bar-chart', `<div class="tk-card"><div class="bc-row">${bars}</div></div>`),
      css: [
        talkingCss(ctx),
        `.bar-chart .bc-row { display: flex; align-items: flex-end; gap: ${num(sz(ctx, 24))}px; padding-top: ${num(sz(ctx, 66))}px; }`,
        '.bar-chart .bc-bar { display: flex; flex-direction: column; align-items: center; }',
        '.bar-chart .bc-track { position: relative; width: 100%; }',
        `.bar-chart .bc-fill { position: absolute; left: 0; bottom: 0; width: 100%; background: ${INK}; border-radius: ${num(sz(ctx, 18))}px; transform-origin: 50% 100%; }`,
        `.bar-chart .bc-val { position: absolute; left: 0; width: 100%; text-align: center; font-weight: 800; font-size: ${num(sz(ctx, 46))}px; line-height: 1; color: ${INK}; }`,
        `.bar-chart .bc-label { font-weight: 600; font-size: ${num(sz(ctx, 36))}px; margin-top: ${num(sz(ctx, 14))}px; color: ${MUTED}; white-space: nowrap; }`,
      ].join('\n'),
      timeline: tl.join('\n'),
    };
  },
};
