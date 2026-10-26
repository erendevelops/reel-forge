import type { Card } from '../../plan';
import { FragmentParams, SCRIPT_ARGS, checkFragment, jsString, namespaceFragment } from '../../plan/fragment';
import { type CardTemplate, type CompileContext, esc, num, regionOf } from '../types';
import { regionClip, talkingCss } from './talking';

/**
 * The scene script's world (runs inside the page's main script, after `const tl` exists):
 * - `tl.to/fromTo/set(target, vars…, at)`: `at` is card-relative seconds (required), `target` a selector inside the
 *   card (`#id` refers to the fragment's own ids), an element or an array of elements. Nothing else of the main
 *   timeline is reachable.
 * - `$`/`$$`: query inside the card; `stage`: the card's stage element; `W`/`H`: its size; `D`: card duration.
 * - `rand()`: seeded random (same plan, same frames). `count()`/`type()`: number count-up and typing as per-frame
 *   `textContent` sets (seekable, no callbacks). `kit`: the plan's look tokens.
 * The stage is reset to its authored html on every run (HyperFrames re-runs body scripts after fonts load).
 */
function scriptRuntime(script: string, id: string, card: Card, ctx: CompileContext, seed: number): string {
  const r = regionOf(ctx);
  const prefix = id;
  return `(function () {
  const stage = document.getElementById(${jsString(id)}).querySelector('.ca-stage');
  if (stage.__base === undefined) stage.__base = stage.innerHTML; else stage.innerHTML = stage.__base;
  const S = ${num(card.start)}, D = ${num(card.end - card.start)}, FPS = ${ctx.fps}, W = ${num(r.w)}, H = ${num(r.h)};
  const kit = ${JSON.stringify(ctx.kit ?? {})};
  const scope = (s) => s.replace(/#(-?[_a-zA-Z][\\w-]*)/g, '#' + ${jsString(prefix)} + '-$1');
  const $$ = (t) => typeof t === 'string' ? Array.from(stage.querySelectorAll(scope(t))) : Array.isArray(t) ? t : [t];
  const $ = (t) => $$(t)[0] || null;
  const pos = (p) => { if (typeof p !== 'number' || !isFinite(p)) throw new Error('tl position must be a number (card seconds)'); return S + p; };
  const T = {
    to: (t, v, p) => tl.to($$(t), v, pos(p)),
    fromTo: (t, a, b, p) => tl.fromTo($$(t), a, b, pos(p)),
    set: (t, v, p) => tl.set($$(t), v, pos(p)),
  };
  let seed = ${seed} >>> 0;
  const rand = () => { seed = (seed + 0x6d2b79f5) >>> 0; let x = seed; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
  const ease = (u) => (u >= 1 ? 1 : 1 - Math.pow(2, -10 * u));
  const count = (t, from, to, at, dur, o) => {
    o = o || {};
    const dec = o.decimals || 0;
    const f = new Intl.NumberFormat(o.locale || 'tr-TR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
    const steps = Math.max(1, Math.round(dur * FPS));
    for (let i = 0; i <= steps; i++) T.set(t, { textContent: (o.prefix || '') + f.format(from + (to - from) * ease(i / steps)) + (o.suffix || '') }, at + (i * dur) / steps);
  };
  const type = (t, text, at, cps) => {
    const chars = Array.from(text), step = 1 / (cps || 18);
    for (let i = 0; i <= chars.length; i++) T.set(t, { textContent: chars.slice(0, i).join('') }, at + i * step);
  };
  try {
    (function (${SCRIPT_ARGS.join(', ')}) {
${script}
    })(T, $, $$, stage, W, H, D, rand, count, type, kit);
  } catch (e) { console.error(${jsString(`custom-animation ${id}:`)}, e); }
})();`;
}

/** Stable per-card seed from its id. */
const seedOf = (id: string) => [...id].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);

/**
 * Claude-authored scene graphics (spec §6): the fragment's HTML/SVG on a stage filling the card's graphics region,
 * its CSS scoped to the card, its literal `tl` calls and/or its scene script at card start + card-relative
 * positions. Rejects a fragment that breaks the rules (see `checkFragment`), so an unvalidated plan cannot smuggle
 * one in.
 */
export const customAnimation: CardTemplate = {
  type: 'custom-animation',
  params: FragmentParams,
  render(card: Card, id: string, ctx: CompileContext) {
    const errors = checkFragment(card.params, card.end - card.start);
    if (errors.length) throw new Error(`custom-animation ${id}: ${errors.join('; ')}`);
    const p = FragmentParams.parse(card.params);
    const f = namespaceFragment(p, id, card.start, ctx.assetsUrl);
    const label = p.label ? ` data-label="${esc(p.label)}"` : '';
    return {
      html: regionClip(id, card, ctx, 'custom-animation', `<div class="ca-stage"${label}>${f.html}</div>`),
      css: [
        talkingCss(ctx),
        '.custom-animation .ca-stage { position: relative; width: 100%; height: 100%; overflow: hidden; }',
        f.css,
      ].filter(Boolean).join('\n'),
      timeline: [f.timeline, p.script.trim() ? scriptRuntime(p.script, id, card, ctx, seedOf(id)) : ''].filter(Boolean).join('\n'),
    };
  },
};
