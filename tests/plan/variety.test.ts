import { describe, expect, it } from 'vitest';
import { checkVariety } from '../../lib/plan/variety';
import type { Plan } from '../../lib/plan';

const scene = (id: string, start: number, cards: Plan['scenes'][number]['cards'], say = '', layout: 'split' | 'broll' = 'split') =>
  ({ id, start, end: start + 3, say, why: '', layout, shots: [], cards });
const plan = (scenes: Plan['scenes'], sfx: Plan['sfx'] = []) => ({ scenes, sfx }) as unknown as Plan;

describe('variety rules', () => {
  it('flags a sound palette over 5 files and cues on top of each other, logos, back-to-back templates and restated lines', () => {
    const errs = checkVariety(plan(
      [
        scene('a', 0, [{ type: 'logo-pop', start: 0, end: 2, params: { img: 'si:youtube' } }, { type: 'typed-title', start: 0, end: 2, params: { text: 'Fear of the camera' } }], 'the big reason is fear of the camera'),
        scene('b', 3, [{ type: 'logo-pop', start: 3, end: 5, params: { img: 'si:youtube' } }]),
      ],
      ['kit/pop', 'kit/click', 'kit/tick', 'kit/impact', 'kit/riser', 'pop/fs527522'].map((f, i) => ({ file: `sfx/${f}.ogg`, at: i === 5 ? 4.05 : i, volume: 1 })),
    ));
    expect(errs.join('\n')).toMatch(/6 different sound files/);
    expect(errs.join('\n')).toMatch(/two cues at 4s and 4.05s/);
    expect(errs.join('\n')).toMatch(/logo si:youtube appears 2 times/);
    expect(errs.join('\n')).toMatch(/both use a logo-pop/);
    expect(errs.join('\n')).toMatch(/restates the spoken line/);
  });

  it('a logo shown by two cards in the same scene (title card + its list row) counts once', () => {
    const errs = checkVariety(plan([
      scene('s', 0, [
        { type: 'title-card', start: 0, end: 2, params: { n: 1, name: 'Claude', logo: 'si:claude' } },
        { type: 'numbered-list', start: 0, end: 3, params: { items: [{ n: 1, name: 'Claude', logo: 'si:claude', at: 1 }] } },
      ]),
    ]));
    expect(errs.join('\n')).not.toMatch(/logo/);
  });

  it('the same sound for the same gesture is fine, and one stamp; a second stamp is refused in every format', () => {
    const files = ['sfx/kit/tick.ogg', 'sfx/kit/tick.ogg', 'sfx/kit/tick.ogg', 'sfx/kit/click.ogg', 'sfx/kit/tick.ogg'];
    const sfx = files.map((file, i) => ({ file, at: i, volume: 1 }));
    const stamp = (start: number) => ({ type: 'stamp' as const, start, end: start + 2, params: { text: 'KALKTI' } });
    expect(checkVariety(plan([scene('a', 0, [stamp(0)], 'kural kalktı')], sfx))).toEqual([]);
    expect(checkVariety(plan([scene('a', 0, [stamp(0)], '', 'broll'), scene('b', 3, [stamp(3)], '', 'broll')])).join(' ')).toMatch(/stamp is used 2 times/);
    const list = { type: 'numbered-list' as const, start: 0, end: 2, params: { items: [] } };
    expect(checkVariety(plan([scene('a', 0, [list], '', 'broll'), scene('b', 3, [list], '', 'broll'), scene('c', 6, [list], '', 'broll')]))).toEqual([]);
  });
});
