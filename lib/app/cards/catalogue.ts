import type { CardType, CaptionStyle, Layout, Selection } from '@/lib/plan/schema';
import type { Preset } from '@/lib/app/workspace/schema';

/**
 * The option-card tiles (spec §6). Each maps to one field of `Selection`: a caption style (single choice), a
 * layout or card type (list membership) or a boolean. Names and descriptions live in i18n under `cards.items.<id>`.
 */
export type CardGroup = 'captions' | 'layout' | 'graphics' | 'topic' | 'sound';
type BoolField = 'sfx' | 'music' | 'punchIns' | 'thumbnail' | 'topicAssets';
export type CardTile =
  | { id: CaptionStyle; group: 'captions'; field: 'captions'; value: CaptionStyle; presets: Preset[] }
  | { id: Layout; group: 'layout'; field: 'layouts'; value: Layout; presets: Preset[] }
  | { id: CardType; group: 'graphics' | 'topic'; field: 'cards'; value: CardType; presets: Preset[] }
  | { id: BoolField; group: 'topic' | 'sound'; field: BoolField; value?: undefined; presets: Preset[] };

const ALL: Preset[] = ['faceless', 'talking-head', 'app-video'];
const REELS: Preset[] = ['faceless', 'talking-head'];

const cap = (id: CaptionStyle): CardTile => ({ id, group: 'captions', field: 'captions', value: id, presets: ALL });
const layout = (id: Layout, presets: Preset[]): CardTile => ({ id, group: 'layout', field: 'layouts', value: id, presets });
const card = (id: CardType, presets: Preset[] = ALL, group: 'graphics' | 'topic' = 'graphics'): CardTile => ({ id, group, field: 'cards', value: id, presets });
const bool = (id: BoolField, group: 'topic' | 'sound', presets: Preset[] = ALL): CardTile => ({ id, group, field: id, presets });

export const CATALOGUE: CardTile[] = [
  cap('word-build'), cap('one-word'), cap('serif-small'), cap('none'),
  layout('full-face', ['talking-head']), layout('split', ['talking-head']), layout('full-graphics', ['talking-head', 'app-video']), layout('broll', REELS),
  card('rolling-number'), card('checklist'), card('bar-chart'), card('stamp'), card('logo-pop'),
  card('numbered-list', REELS), card('typed-title'), card('title-card', REELS), card('follow-outro', REELS),
  bool('topicAssets', 'topic'), card('custom-animation', ALL, 'topic'),
  bool('sfx', 'sound'), bool('music', 'sound'), bool('punchIns', 'sound', REELS), bool('thumbnail', 'sound'),
];

export const GROUPS: CardGroup[] = ['captions', 'layout', 'graphics', 'topic', 'sound'];

export const tilesFor = (preset: Preset): CardTile[] => CATALOGUE.filter((t) => t.presets.includes(preset));

export function isOn(sel: Selection, t: CardTile): boolean {
  switch (t.field) {
    case 'captions': return sel.captions === t.value;
    case 'layouts': return sel.layouts.includes(t.value);
    case 'cards': return sel.cards.includes(t.value);
    default: return sel[t.field];
  }
}

const flip = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

/** The selection after clicking `t`. Custom animations are topic assets: ticking one ticks the other on, unticking topic assets drops custom animations. */
export function toggle(sel: Selection, t: CardTile): Selection {
  switch (t.field) {
    case 'captions': return { ...sel, captions: t.value };
    case 'layouts': return { ...sel, layouts: flip(sel.layouts, t.value) };
    case 'cards': {
      const cards = flip(sel.cards, t.value);
      return { ...sel, cards, topicAssets: t.value === 'custom-animation' && cards.includes('custom-animation') ? true : sel.topicAssets };
    }
    case 'topicAssets': {
      const on = !sel.topicAssets;
      return { ...sel, topicAssets: on, cards: on ? sel.cards : sel.cards.filter((c) => c !== 'custom-animation') };
    }
    default: return { ...sel, [t.field]: !sel[t.field] };
  }
}
