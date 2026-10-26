import { describe, expect, it } from 'vitest';
import { checkVariety } from '../../lib/plan/variety';
import type { Plan } from '../../lib/plan';

const scene = (id: string, start: number, cards: Plan['scenes'][number]['cards'], say = '', layout: 'split' | 'broll' = 'split') =>
  ({ id, start, end: start + 3, say, why: '', layout, shots: [], cards });
const plan = (scenes: Plan['scenes'], sfx: Plan['sfx'] = []) => ({ scenes, sfx }) as unknown as Plan;

describe('variety rules', () => {
  it('flags repeated sounds, logos, back-to-back templates and restated lines', () => {
    const errs = checkVariety(plan(
      [
        scene('a', 0, [{ type: 'logo-pop', start: 0, end: 2, params: { img: 'si:youtube' } }, { type: 'typed-title', start: 0, end: 2, params: { text: 'Fear of the camera' } }], 'the big reason is fear of the camera'),
        scene('b', 3, [{ type: 'logo-pop', start: 3, end: 5, params: { img: 'si:youtube' } }]),
      ],
      [{ file: 'sfx/drop_001.wav', at: 0, volume: 1 }, { file: 'sfx/drop_001.wav', at: 1, volume: 1 }, { file: 'sfx/drop_001.wav', at: 4, volume: 1 }],
    ));
    expect(errs.join('\n')).toMatch(/plays twice in a row/);
    expect(errs.join('\n')).toMatch(/used 3 times/);
    expect(errs.join('\n')).toMatch(/logo si:youtube appears 2 times/);
    expect(errs.join('\n')).toMatch(/both use a logo-pop/);
    expect(errs.join('\n')).toMatch(/restates the spoken line/);
  });

  it('allows keyboard typing runs and varied plans; exempts faceless B-roll reels', () => {
    const typing = [1, 2, 3, 4].map((i) => ({ file: 'sfx/keyboard/keypress-001.wav', at: i / 10, volume: 1 }));
    expect(checkVariety(plan([scene('a', 0, [{ type: 'stamp', start: 0, end: 2, params: { text: 'KALKTI' } }], 'kural kalktı')], typing))).toEqual([]);
    const list = { type: 'numbered-list' as const, start: 0, end: 2, params: { items: [] } };
    expect(checkVariety(plan([scene('a', 0, [list], '', 'broll'), scene('b', 3, [list], '', 'broll'), scene('c', 6, [list], '', 'broll')]))).toEqual([]);
  });
});
