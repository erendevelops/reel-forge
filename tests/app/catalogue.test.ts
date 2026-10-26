import { describe, expect, it } from 'vitest';
import { CATALOGUE, isOn, tilesFor, toggle } from '../../lib/app/cards/catalogue';
import { CAPTION_STYLES, CARD_TYPES, LAYOUTS } from '../../lib/plan/schema';
import { defaultSelection } from '../../lib/app/claude/install';

const tile = (id: string) => CATALOGUE.find((t) => t.id === id)!;

describe('option card catalogue', () => {
  it('has exactly one tile per caption style, layout and card type', () => {
    for (const v of [...CAPTION_STYLES, ...LAYOUTS, ...CARD_TYPES]) expect(CATALOGUE.filter((t) => t.value === v)).toHaveLength(1);
    expect(new Set(CATALOGUE.map((t) => t.id)).size).toBe(CATALOGUE.length);
  });

  it('app videos get no face layouts, B-roll or punch-ins', () => {
    const ids = tilesFor('app-video').map((t) => t.id);
    for (const x of ['split', 'full-face', 'broll', 'punchIns']) expect(ids).not.toContain(x);
    expect(ids).toContain('custom-animation');
  });

  it('captions are single-choice; other tiles toggle', () => {
    const sel = defaultSelection('talking-head');
    expect(toggle(sel, tile('one-word')).captions).toBe('one-word');
    expect(toggle(sel, tile('stamp')).cards).not.toContain('stamp');
    expect(toggle(toggle(sel, tile('stamp')), tile('stamp')).cards).toContain('stamp');
    expect(toggle(sel, tile('sfx')).sfx).toBe(false);
  });

  it('custom animations need topic assets', () => {
    const off = { ...defaultSelection('faceless') };
    const on = toggle(off, tile('custom-animation'));
    expect(on.cards).toContain('custom-animation');
    expect(on.topicAssets).toBe(true);
    const back = toggle(on, tile('topicAssets'));
    expect(back.topicAssets).toBe(false);
    expect(back.cards).not.toContain('custom-animation');
    expect(isOn(back, tile('custom-animation'))).toBe(false);
  });
});
