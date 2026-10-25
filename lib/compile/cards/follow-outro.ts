import type { Card } from '../../plan';
import { FollowOutroParams } from '../../plan/card-params';
import { type CardTemplate, type CompileContext, esc, num, sz, tlFromTo, tlSet } from '../types';
import { GREEN, INK, cardInOut, regionClip, talkingCss } from './talking';

const Params = FollowOutroParams;

const PLUS_SVG =
  '<svg viewBox="0 0 24 24" width="100%" height="100%"><path d="M12 5v14M5 12h14" fill="none" stroke="#FFFFFF" stroke-width="3.2" stroke-linecap="round"/></svg>';
const CHECK_SVG =
  '<svg viewBox="0 0 24 24" width="100%" height="100%"><polyline points="5,12.5 10,17.5 19,7" fill="none" stroke="#FFFFFF" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/**
 * Follow outro: the handle on a white card with a round follow button. The button pops in, is pressed
 * (scale 1 → 0.9 → 1) and turns into a green tick, like the app's followed state.
 */
export const followOutro: CardTemplate = {
  type: 'follow-outro',
  params: Params,
  render(card: Card, id: string, ctx: CompileContext) {
    const p = Params.parse(card.params);
    const btn = `#${id} .fo-btn`;
    const popAt = card.start + 0.3;
    // the press starts after the pop has finished so no two scale tweens overlap
    const pressAt = Math.max(popAt + 0.4, Math.min(card.start + 0.85, card.end - 0.5));
    const size = sz(ctx, 96);
    const tl = cardInOut(`#${id} .tk-card`, card, ctx);
    tl.push(
      tlFromTo(btn, { scale: 0.4, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, ease: 'back.out(1.7)' }, popAt),
      tlFromTo(btn, { scale: 1 }, { scale: 0.9, duration: 0.08, ease: 'power2.out', immediateRender: false }, pressAt),
      tlFromTo(btn, { scale: 0.9 }, { scale: 1, duration: 0.3, ease: 'expo.out', immediateRender: false }, pressAt + 0.08),
      tlSet(btn, { background: GREEN }, pressAt),
      tlSet(`#${id} .fo-plus`, { opacity: 0 }, pressAt),
      tlSet(`#${id} .fo-check`, { opacity: 1 }, pressAt),
    );
    const inner =
      `<div class="tk-card fo-row"><span class="fo-handle">${esc(p.handle)}</span>` +
      `<span class="fo-btn" style="width: ${num(size)}px; height: ${num(size)}px; border-radius: ${num(size / 2)}px;">` +
      `<span class="fo-icon fo-plus">${PLUS_SVG}</span><span class="fo-icon fo-check" style="opacity: 0;">${CHECK_SVG}</span></span></div>`;
    return {
      html: regionClip(id, card, ctx, 'follow-outro', inner),
      css: [
        talkingCss(ctx),
        `.follow-outro .fo-row { display: flex; align-items: center; gap: ${num(sz(ctx, 32))}px; }`,
        `.follow-outro .fo-handle { font-weight: 900; font-size: ${num(sz(ctx, 72))}px; color: ${INK}; white-space: nowrap; }`,
        `.follow-outro .fo-btn { position: relative; flex-shrink: 0; opacity: 0; background: ${INK}; }`,
        '.follow-outro .fo-icon { position: absolute; left: 22%; top: 22%; width: 56%; height: 56%; }',
      ].join('\n'),
      timeline: tl.join('\n'),
    };
  },
};
