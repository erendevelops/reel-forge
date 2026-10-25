import type { Card } from '../../plan';
import { RollingNumberParams } from '../../plan/card-params';
import { type CardTemplate, type CompileContext, esc, num, regionOf, sz, tlFromTo } from '../types';
import { INK, cardInOut, regionClip, talkingCss } from './talking';

const Params = RollingNumberParams;

/** prao doc §5 scene 1: each digit column rolls 0.9 s `expo.out`, right-most first, 0.07 s apart. */
const ROLL = { duration: 0.9, ease: 'expo.out' };
const STAGGER = 0.07;
const LEAD = 0.1;
/** Digit window height relative to the font size (prao: 210 px window for 200 px type). */
const WINDOW = 1.05;

const decimals = (v: number) => Math.min(2, (String(v).split('.')[1] ?? '').length);

/**
 * Rolling number (prao RollingText): every digit of `to` (formatted for `locale`) is a slot column, a window
 * holding the strip 0–9 twice. The strip tweens `y` from the matching digit of `from` to `-(10 + digit) × window`,
 * so each column spins once and lands. Separators and the suffix fade in after; the whole number un-blurs in.
 */
export const rollingNumber: CardTemplate = {
  type: 'rolling-number',
  params: Params,
  render(card: Card, id: string, ctx: CompileContext) {
    const p = Params.parse(card.params);
    const dec = Math.max(decimals(p.from), decimals(p.to));
    const fmt = new Intl.NumberFormat(p.locale, { minimumFractionDigits: dec, maximumFractionDigits: dec });
    const toStr = fmt.format(p.to);
    const toDigits = [...toStr].filter((c) => /\d/.test(c)).map(Number);
    const fromRaw = [...fmt.format(Math.abs(p.from))].filter((c) => /\d/.test(c)).map(Number);
    // right-align `from` against the columns of `to`; missing leading digits start at 0
    const fromDigits = toDigits.map((_, k) => fromRaw[fromRaw.length - toDigits.length + k] ?? 0);

    const chars = toStr.length + (p.suffix?.length ?? 0);
    const font = Math.min(sz(ctx, 200), (regionOf(ctx).w * 0.78) / (0.64 * chars));
    const win = font * WINDOW;
    const strip = Array.from({ length: 20 }, (_, d) => `<span class="rn-dig" style="height: ${num(win)}px;">${d % 10}</span>`).join('');

    const tl = cardInOut(`#${id} .tk-card`, card, ctx);
    const n = toDigits.length;
    let k = 0;
    const cols: string[] = [];
    for (const c of toStr) {
      if (!/\d/.test(c)) {
        cols.push(`<span class="rn-sep">${esc(c)}</span>`);
        continue;
      }
      k++;
      const sel = `#${id}-d${k}`;
      cols.push(`<span class="rn-col" style="height: ${num(win)}px;" data-layout-ignore><span id="${id}-d${k}" class="rn-strip">${strip}</span></span>`);
      const at = card.start + LEAD + (n - k) * STAGGER;
      tl.push(tlFromTo(sel, { y: -fromDigits[k - 1] * win }, { y: -(10 + toDigits[k - 1]) * win, ...ROLL }, at));
    }
    if (p.suffix) cols.push(`<span class="rn-sep rn-suffix">${esc(p.suffix)}</span>`);
    const sepAt = card.start + LEAD + Math.max(0, n - 1) * STAGGER + 0.25;
    if (cols.length > n) tl.push(tlFromTo(`#${id} .rn-sep`, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'power2.out' }, sepAt));
    tl.push(tlFromTo(`#${id} .rn-num`, { filter: 'blur(10px)', scale: 1.06 }, { filter: 'blur(0px)', scale: 1, duration: 0.6, ease: 'expo.out' }, card.start + LEAD));

    const label = esc(toStr + (p.suffix ?? ''));
    return {
      html: regionClip(id, card, ctx, 'rolling-number', `<div class="tk-card"><div class="rn-num" aria-label="${label}" style="font-size: ${num(font)}px; line-height: ${num(win)}px;">${cols.join('')}</div></div>`),
      css: [
        talkingCss(ctx),
        `.rolling-number .rn-num { display: flex; align-items: flex-start; font-family: 'Inter', sans-serif; font-weight: 800; color: ${INK}; font-variant-numeric: tabular-nums; white-space: pre; }`,
        '.rolling-number .rn-col { display: inline-block; overflow: hidden; }',
        '.rolling-number .rn-strip { display: flex; flex-direction: column; }',
        '.rolling-number .rn-dig { display: flex; align-items: center; justify-content: center; }',
        '.rolling-number .rn-sep { display: inline-block; opacity: 0; }',
      ].join('\n'),
      timeline: tl.join('\n'),
    };
  },
};
