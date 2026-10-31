import { describe, it, expect } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { motionGaps, validatePlan, type Plan } from '../../lib/plan';

const scene = (id: string, start: number, end: number, extra: Record<string, unknown> = {}) =>
  ({ id, start, end, say: 'words', why: '', shots: [], cards: [], ...extra });

function plan(scenes: unknown[], duration: number): Plan {
  const v = validatePlan({
    version: 1, lang: 'en', mode: 'reel', fps: 60, duration, ratios: ['9:16'],
    selection: { captions: 'none', layouts: ['full-face', 'split'], cards: ['checklist', 'stamp', 'numbered-list'], sfx: false, music: false, punchIns: false, thumbnail: false },
    scenes, captions: { style: 'none', groups: [] }, sfx: [],
  });
  if (!v.ok) throw new Error(v.errors.join('\n'));
  return v.plan;
}

describe('motionGaps', () => {
  it('flags speech stretches over 3 s without a visual event', () => {
    const p = plan([
      scene('a', 0, 4, { layout: 'full-face' }), // 0-4: nothing
      scene('b', 4, 12, {
        layout: 'split', // layout change at 4
        cards: [
          { type: 'checklist', start: 5, end: 12, params: { items: [{ label: 'x', at: 6 }, { label: 'y', at: 10 }] } },
        ],
      }),
      scene('c', 12, 16, { say: '', layout: 'split' }), // silent: never flagged
      scene('d', 16, 20, { layout: 'split', cards: [{ type: 'stamp', start: 16.5, end: 17, params: { text: 'X' } }] }),
    ], 20);
    // events: 4 (layout), 5 (card), 6, 10 (ticks), 16.5 (card); gaps 0-4, 6-10, 16.5-20
    // (10-16.5 is 6.5 s but only 10-12 is speech)
    expect(motionGaps(p)).toEqual([{ from: 0, to: 4 }, { from: 6, to: 10 }, { from: 16.5, to: 20 }]);
  });

  it('counts numbered-list landings and ignores gaps up to 3 s', () => {
    const p = plan([
      scene('a', 0, 6, {
        layout: 'full-face',
        cards: [{ type: 'numbered-list', start: 0, end: 6, params: { items: [{ n: 1, name: 'A', at: 2 }, { n: 2, name: 'B', at: 4.5 }] } }],
      }),
    ], 6);
    expect(motionGaps(p)).toEqual([]);
  });

  it('reports the gaps of the talking-head spike plan', async () => {
    const raw = JSON.parse(await fs.readFile(path.resolve(__dirname, '../fixtures/plan-talking-head.json'), 'utf8'));
    const v = validatePlan(raw);
    expect(v.ok, v.ok ? '' : v.errors.join('\n')).toBe(true);
    if (!v.ok) return;
    const gaps = motionGaps(v.plan);
    console.log('spike motionGaps', JSON.stringify(gaps));
    expect(gaps).toEqual([
      { from: 0, to: 7 },
      { from: 7, to: 14.18 },
      { from: 17.72, to: 23.78 },
      { from: 25.72, to: 34.42 },
      { from: 34.42, to: 38.16 },
      { from: 38.16, to: 43.2 },
      { from: 43.3, to: 46.6 },
      { from: 46.6, to: 52.1 },
    ]);
  });
});

describe('graphicGaps / unusedCards', () => {
  it('finds footage-only stretches over 5 s and ticked cards the plan never uses', async () => {
    const { graphicGaps, unusedCards } = await import('../../lib/plan');
    const card = (type: string, start: number, end: number) => ({ type, start, end, params: {} });
    const p = { duration: 20, scenes: [{ cards: [card('stamp', 1, 2)] }, { cards: [card('checklist', 4, 6.5)] }] } as unknown as Plan;
    expect(graphicGaps(p)).toEqual([{ from: 6.5, to: 20 }]);
    expect(unusedCards(p, ['stamp', 'checklist', 'numbered-list'])).toEqual(['numbered-list']);
  });
});
