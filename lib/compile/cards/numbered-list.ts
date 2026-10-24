import { z } from 'zod';
import type { Card } from '../../plan';
import { type CardTemplate, type CompileContext, YELLOW, WHITE, clipDiv, esc, fx, fy, num, sz, tlFromTo, tlSet } from '../types';
import { TOOL_ICON_CSS, toolIcon } from './icon';

const Item = z.object({
  n: z.number().int().nonnegative(),
  name: z.string().min(1),
  logo: z.string().min(1).optional(),
  at: z.number().finite().nonnegative(),
});
const Params = z.object({
  items: z.array(Item).min(1),
  highlight: z.enum(['latest', 'none']).default('latest'),
});

/** Spring(damping 16, stiffness 160) slide from −60 px ≈ back.out(1.2) over 0.5 s. */
const SLIDE = { duration: 0.5, ease: 'back.out(1.2)' };

/**
 * Top-left numbered list (reel doc §7.3): `left: 100, top: 200`, 46 px logo + "N. Name" in Inter 800
 * at 42 px. Items with `at <= card.start` render already landed; later ones slide in from −60 px at
 * `at`. `highlight: 'latest'` keeps the most recently landed item yellow; `'none'` is all white.
 */
export const numberedList: CardTemplate = {
  type: 'numbered-list',
  params: Params,
  render(card: Card, id: string, ctx: CompileContext) {
    const p = Params.parse(card.params);
    const rowId = (i: number) => `${id}-i${i + 1}`;
    const landed = (i: number) => p.items[i].at <= card.start;
    // landing order: by time, ties by list order
    const order = p.items.map((_, i) => i).sort((a, b) => p.items[a].at - p.items[b].at || a - b);
    const initiallyLanded = order.filter(landed);
    let latest = p.highlight === 'latest' && initiallyLanded.length ? initiallyLanded[initiallyLanded.length - 1] : -1;
    const initialLatest = latest;

    const tl: string[] = [];
    for (const i of order) {
      if (landed(i)) continue;
      const at = p.items[i].at;
      tl.push(tlFromTo(`#${rowId(i)}`, { opacity: 0, x: -sz(ctx, 60) }, { opacity: 1, x: 0, ...SLIDE }, at));
      if (p.highlight === 'latest') {
        tl.push(tlSet(`#${rowId(i)}`, { color: YELLOW }, at));
        if (latest >= 0) tl.push(tlSet(`#${rowId(latest)}`, { color: WHITE }, at));
        latest = i;
      }
    }

    const icon = sz(ctx, 46);
    const rows = p.items
      .map((it, i) => {
        const color = i === initialLatest ? YELLOW : WHITE;
        const opacity = landed(i) ? 1 : 0;
        return `<div id="${rowId(i)}" class="nl-row" style="opacity: ${opacity}; color: ${color};">${toolIcon(ctx, it.logo, icon, it.name)}<span>${it.n}. ${esc(it.name)}</span></div>`;
      })
      .join('');
    const box = `<div class="nl-box" style="left: ${num(fx(ctx, 100))}px; top: ${num(fy(ctx, 200))}px;">${rows}</div>`;
    return {
      html: clipDiv(id, card.start, card.end, 'numbered-list', box),
      css: [
        TOOL_ICON_CSS,
        '.numbered-list { position: absolute; left: 0; top: 0; width: 100%; height: 100%; z-index: 4; }',
        '.numbered-list .nl-box { position: absolute; }',
        `.numbered-list .nl-row { display: flex; align-items: center; gap: ${num(sz(ctx, 14))}px; margin-bottom: ${num(sz(ctx, 8))}px; font-family: 'Inter', sans-serif; font-weight: 800; font-size: ${num(sz(ctx, 42))}px; line-height: 1.3; white-space: nowrap; text-shadow: 0 3px 12px rgba(0,0,0,0.85); }`,
      ].join('\n'),
      timeline: tl.join('\n'),
    };
  },
};
