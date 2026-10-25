import type { Card } from '../../plan';
import { FragmentParams, checkFragment, namespaceFragment } from '../../plan/fragment';
import { type CardTemplate, type CompileContext, esc } from '../types';
import { regionClip, talkingCss } from './talking';

/**
 * Claude-authored topic animation (spec §6): the fragment's HTML/SVG on a stage filling the card's graphics region,
 * its CSS scoped to the card, its `tl` calls at card start + their card-relative positions. Rejects a fragment
 * that breaks the rules (see `checkFragment`), so an unvalidated plan cannot smuggle one in.
 */
export const customAnimation: CardTemplate = {
  type: 'custom-animation',
  params: FragmentParams,
  render(card: Card, id: string, ctx: CompileContext) {
    const errors = checkFragment(card.params, card.end - card.start);
    if (errors.length) throw new Error(`custom-animation ${id}: ${errors.join('; ')}`);
    const p = FragmentParams.parse(card.params);
    const f = namespaceFragment(p, id, card.start);
    const label = p.label ? ` data-label="${esc(p.label)}"` : '';
    return {
      html: regionClip(id, card, ctx, 'custom-animation', `<div class="ca-stage"${label}>${f.html}</div>`),
      css: [
        talkingCss(ctx),
        '.custom-animation .ca-stage { position: relative; width: 100%; height: 100%; overflow: hidden; }',
        f.css,
      ].filter(Boolean).join('\n'),
      timeline: f.timeline,
    };
  },
};
