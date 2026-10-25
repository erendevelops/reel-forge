import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { makeClip } from '../helpers/media';
import { run } from '../../lib/media/run';
import { npx } from '../../lib/media/npx';
import { validatePlan, type Plan } from '../../lib/plan';
import { compile } from '../../lib/compile';
import { cardRegistry } from '../../lib/compile/cards';

let tmp: string;
let assetsDir: string;

const ctx = { width: 1080, height: 1920, fps: 60, ratio: '9:16' as const, assetsUrl: (p: string) => `assets/${p}` };

function timeline(src: string): string {
  return (src.match(/<script>([\s\S]*?)<\/script>/g) ?? []).join('\n');
}

/** A talking-head plan: full-face hook, split explainer, full-graphics beat, split outro. */
function talkingPlan(): Plan {
  const v = validatePlan({
    version: 1,
    mode: 'reel',
    fps: 60,
    duration: 12,
    ratios: ['9:16'],
    selection: { captions: 'none', layouts: ['full-face', 'split', 'full-graphics'], cards: ['checklist', 'rolling-number', 'typed-title', 'stamp', 'bar-chart', 'follow-outro'], sfx: false, music: false, punchIns: false, thumbnail: false },
    scenes: [
      { id: 'hook', start: 0, end: 2, say: '', why: '', layout: 'full-face', shots: [{ src: 'face.mp4', from: 0, to: 2, at: 0 }], cards: [] },
      {
        id: 'steps', start: 2, end: 6, say: '', why: '', layout: 'split',
        shots: [{ src: 'face.mp4', from: 2, to: 6, at: 2 }],
        cards: [
          { type: 'checklist', start: 2, end: 6, params: { items: [{ label: 'Kurulum', at: 2.5 }, { label: 'Kayıt', at: 3.2 }, { label: 'Yayın', at: 4.1 }] } },
        ],
      },
      {
        id: 'numbers', start: 6, end: 9, say: '', why: '', layout: 'full-graphics',
        shots: [{ src: 'face.mp4', from: 6, to: 9, at: 6 }],
        cards: [
          { type: 'rolling-number', start: 6, end: 9, params: { from: 0, to: 33769, locale: 'tr-TR', suffix: ' ₺' } },
          { type: 'typed-title', start: 6.5, end: 9, params: { text: 'Bu ay', label: 'Soru' } },
        ],
      },
      {
        id: 'outro', start: 9, end: 12, say: '', why: '', layout: 'split',
        shots: [{ src: 'face.mp4', from: 9, to: 12, at: 9 }],
        cards: [
          { type: 'stamp', start: 9, end: 10, params: { text: 'BİTTİ' } },
          { type: 'bar-chart', start: 9.5, end: 11, params: { bars: [{ label: 'Ocak', value: 10 }, { label: 'Şubat', value: 25 }] } },
          { type: 'follow-outro', start: 11, end: 12, params: { handle: '@onur.builds' } },
        ],
      },
    ],
    captions: { style: 'none', groups: [] },
    sfx: [],
  });
  if (!v.ok) throw new Error(v.errors.join('\n'));
  return v.plan;
}

let html: string;
let tl: string;

beforeAll(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'talking-'));
  assetsDir = path.join(tmp, 'media');
  await fs.mkdir(assetsDir);
  const clip = await makeClip(assetsDir, { w: 64, h: 112, fps: 60, seconds: 13 });
  await fs.rename(clip, path.join(assetsDir, 'face.mp4'));
  ({ indexHtml: html } = await compile(talkingPlan(), { outDir: path.join(tmp, 'out'), assetsDir, ratio: '9:16' }));
  tl = timeline(html);
}, 120000);

afterAll(async () => {
  if (tmp) await fs.rm(tmp, { recursive: true, force: true });
});

describe('talking-head cards', () => {
  it('cards land on their words', () => {
    const line = tl.split('\n').find((l) => l.includes('#steps-checklist-1-i2 .ck-tick'));
    expect(line).toBeDefined();
    const at = Number(/, (-?[\d.]+)\);$/.exec(line!)![1]);
    expect(Math.abs(at - 3.2)).toBeLessThanOrEqual(0.001);
    expect(line).toMatch(/^tl\.fromTo\(/);
  });

  it('typed-title has no fromTo', () => {
    const f = cardRegistry['typed-title'].render({ type: 'typed-title', start: 1, end: 4, params: { text: 'Merhaba', label: 'Başlık' } }, 'tt', ctx);
    const states = f.timeline.split('\n').filter((l) => l.includes('#tt-s'));
    expect(states.length).toBeGreaterThan(0);
    for (const l of states) {
      expect(l).not.toContain('fromTo(');
      expect(l).toMatch(/^tl\.set\(/);
    }
    // one state per character, each shown with tl.set at its own time; all hidden in the HTML
    for (let i = 1; i <= 'Merhaba'.length; i++) expect(f.timeline).toMatch(new RegExp(`tl\\.set\\("#tt-s${i}", \\{ opacity: 1 \\}`));
    expect(f.html).not.toMatch(/class="tt-state"[^>]*opacity: 1/);
    expect(tl).not.toMatch(/fromTo\("#numbers-typed-title-1-s/);
  });

  it('rolling-number rolls digit columns 0.9 s expo.out, 0.07 s stagger right to left', () => {
    // 33.769 → 5 digit columns
    const rolls = tl.split('\n').filter((l) => /#numbers-rolling-number-1-d\d+"/.test(l));
    expect(rolls).toHaveLength(5);
    const at = (l: string) => Number(/, (-?[\d.]+)\);$/.exec(l)![1]);
    const byCol = (k: number) => rolls.find((l) => l.includes(`-d${k}"`))!;
    expect(byCol(5)).toContain('duration: 0.9, ease: "expo.out"');
    expect(at(byCol(4)) - at(byCol(5))).toBeCloseTo(0.07, 3);
    expect(at(byCol(1)) - at(byCol(5))).toBeCloseTo(0.28, 3);
    expect(html).toContain('33.769');
    expect(html).toContain('₺');
  });

  it('stamp slams scale 2 → 1 at −12°', () => {
    expect(tl).toMatch(/tl\.fromTo\("#outro-stamp-1 \.st-stamp", \{ scale: 2, opacity: 0, rotation: -12 \}, \{ scale: 1, opacity: 1, rotation: -12, /);
  });

  it('bar-chart grows bars proportional to value', () => {
    expect(tl).toMatch(/#outro-bar-chart-1-b1 \.bc-fill/);
    expect(html).toMatch(/id="outro-bar-chart-1-b2"[\s\S]*?height: 100%/);
    expect(html).toMatch(/id="outro-bar-chart-1-b1"[\s\S]*?height: 40%/);
  });

  it('follow-outro shows the handle', () => {
    expect(html).toContain('@onur.builds');
  });

  it('every card is registered', () => {
    for (const t of ['rolling-number', 'checklist', 'stamp', 'bar-chart', 'typed-title', 'follow-outro'] as const) {
      expect(() => cardRegistry[t].params.parse({})).toThrow();
    }
    expect(tl).not.toMatch(/tl\.from\(/);
  });
});

describe('layouts', () => {
  it('split puts the face in a rounded 70% card on #F7F3EA', () => {
    expect(html).toContain('#F7F3EA');
    // steps scene (2 s) turns into split: 70% wide, 28 px radius, 0.4 s expo.out
    const t = tl.split('\n').find((l) => l.startsWith('tl.fromTo("#face"') && l.endsWith(', 2);'))!;
    expect(t).toBeDefined();
    expect(t).toContain(`width: ${0.7 * 1080}`);
    expect(t).toContain('borderRadius: 28');
    expect(t).toContain('duration: 0.4, ease: "expo.out"');
    expect(t).toContain('immediateRender: false');
  });

  it('full-graphics hides the face; split brings it back', () => {
    const hide = tl.split('\n').find((l) => l.startsWith('tl.fromTo("#face"') && l.endsWith(', 6);'))!;
    expect(hide).toMatch(/\}, \{ [^}]*opacity: 0[,\s]/);
    const back = tl.split('\n').find((l) => l.startsWith('tl.fromTo("#face"') && l.endsWith(', 9);'))!;
    expect(back).toMatch(/\}, \{ [^}]*opacity: 1[,\s]/);
  });

  it('first scene layout is the initial inline state, no tween at 0', () => {
    expect(tl).not.toMatch(/tl\.fromTo\("#face"[^\n]*, 0\);/);
    expect(html).toMatch(/<div id="face"[^>]*style="[^"]*width: 1080px; height: 1920px;/);
  });

  it('cards in split scenes sit in the top half', () => {
    expect(html).toMatch(/id="steps-checklist-1"[^>]*style="[^"]*top: 0px; [^"]*height: 960px;/);
    expect(html).toMatch(/id="numbers-rolling-number-1"[^>]*style="[^"]*height: 1920px;/);
  });

  it('hyperframes lint passes', async () => {
    const [cmd, args] = npx(['-y', 'hyperframes@0.8.191', 'lint', path.join(tmp, 'out')]);
    const res = await run(cmd, args, { timeoutMs: 120000 });
    expect(res.code).toBe(0);
  }, 130000);

  it('is deterministic', async () => {
    const again = await compile(talkingPlan(), { outDir: path.join(tmp, 'out2'), assetsDir, ratio: '9:16' });
    expect(again.indexHtml).toBe(html);
  });
});
