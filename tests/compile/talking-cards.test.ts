import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
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
    lang: 'tr',
    mode: 'reel',
    fps: 60,
    duration: 12,
    ratios: ['9:16'],
    selection: { captions: 'none', layouts: ['full-face', 'split', 'full-graphics'], cards: ['checklist', 'rolling-number', 'typed-title', 'stamp', 'bar-chart', 'follow-outro', 'custom-animation'], sfx: false, music: false, punchIns: false, thumbnail: false, topicAssets: true },
    scenes: [
      { id: 'hook', start: 0, end: 2, say: '', why: '', layout: 'full-face', shots: [{ src: 'face.mp4', from: 0, to: 2, at: 0 }], cards: [] },
      {
        id: 'steps', start: 2, end: 6, say: '', why: '', layout: 'split', facePos: { x: 0.5, y: 0.22 },
        shots: [{ src: 'face.mp4', from: 2, to: 6, at: 2 }],
        cards: [
          { type: 'checklist', start: 2, end: 6, params: { items: [{ label: 'Kurulum', at: 2.5 }, { label: 'Kayıt', at: 3.2 }, { label: 'Yayın', at: 4.1 }] } },
          {
            type: 'custom-animation', start: 4.5, end: 6,
            params: {
              html: '<svg viewBox="0 0 100 50" class="flow"><circle id="dot" cx="10" cy="25" r="6" fill="#16A34A"/></svg>',
              css: '.flow { width: 70%; }',
              timeline: 'tl.fromTo("#dot", { x: 0 }, { x: 80, duration: 0.6, ease: "power2.inOut" }, 0.1);',
              label: 'a dot flows right',
            },
          },
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
        // a horizontal source in the split card: the card takes the source's 16:9 aspect
        shots: [{ src: 'face.mp4', from: 9, to: 12, at: 9, aspect: 16 / 9 }],
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
  it('split shows the whole source frame in a rounded card at the source aspect on #F7F3EA', () => {
    expect(html).toContain('#F7F3EA');
    // steps scene (2 s) turns into split; its shot has no aspect, so the source is the 9:16 working clip:
    // the card is the tallest 9:16 box in the bottom half (880 px: half height minus two 40 px gaps), 28 px radius
    const t = tl.split('\n').find((l) => l.startsWith('tl.fromTo("#face"') && l.endsWith(', 2);'))!;
    expect(t).toBeDefined();
    expect(t).toContain('{ x: 292.5, y: 1000, width: 495, height: 880, borderRadius: 28');
    expect(t).toContain('duration: 0.4, ease: "expo.out"');
    expect(t).toContain('immediateRender: false');
    // outro: a 16:9 source gets a 16:9 card (92% wide), centred in the bottom half
    const o = tl.split('\n').find((l) => l.startsWith('tl.fromTo("#face"') && l.endsWith(', 9);'))!;
    expect(o).toContain('width: 993.6, height: 558.9, borderRadius: 28');
    expect(Math.abs(993.6 / 558.9 - 16 / 9)).toBeLessThan(0.001);
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

  it('split face card never crops into the face: contain, no facePos crop', () => {
    // shot-2 (steps, split, facePos y 0.22) and shot-4 (outro, split) are contained; full-face shot-1 stays cover
    expect(html).toMatch(/id="shot-2-video"[^>]*style="object-fit: contain;"/);
    expect(html).toMatch(/id="shot-4-video"[^>]*style="object-fit: contain;"/);
    expect(html).not.toMatch(/id="shot-2-video"[^>]*object-position/);
    expect(html).not.toMatch(/id="shot-1-video"[^>]*style=/);
  });

  it('custom-animation compiles into the page: scoped, offset, valid JS', () => {
    expect(html).toContain('id="steps-custom-animation-1-dot"');
    expect(tl).toContain('tl.fromTo("#steps-custom-animation-1 #steps-custom-animation-1-dot", { x: 0 }, { x: 80, duration: 0.6, ease: "power2.inOut" }, 4.6);');
    const script = /<script>\n([\s\S]*?)<\/script>/.exec(html)![1];
    expect(() => new Function('gsap', script)).not.toThrow();
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

  /** `hyperframes validate` (page load in headless Chrome, no render) of a copy of the project with `extra` before </body>. */
  async function validate(name: string, extra: string): Promise<{ ok: boolean; errors: { text: string }[]; warnings: { text: string }[] }> {
    const dir = path.join(tmp, name);
    await fs.cp(path.join(tmp, 'out'), dir, { recursive: true });
    const f = path.join(dir, 'index.html');
    await fs.writeFile(f, (await fs.readFile(f, 'utf8')).replace('</body>', `${extra}\n</body>`));
    const [cmd, args] = npx(['-y', 'hyperframes@0.8.191', 'validate', '--json', '--no-contrast', '--timeout', '3000', dir]);
    const res = spawnSync(cmd, args, { encoding: 'utf8', shell: false, windowsHide: true, timeout: 120000 });
    return JSON.parse(res.stdout.slice(res.stdout.indexOf('{')));
  }

  it('CSP keeps the HyperFrames runtime and GSAP running, blocks eval and network', async () => {
    const clean = await validate('csp-clean', '<script>console.warn("TL-DURATION " + window.__timelines.main.duration());</script>');
    expect(clean.errors, JSON.stringify(clean.errors)).toEqual([]);
    expect(clean.warnings.map((w) => w.text).join('\n')).toMatch(/TL-DURATION 12/);
    const bad = await validate('csp-bad',
      '<img src="https://example.com/x.png"><script>try { new Function("return 1")(); console.warn("EVAL-RAN"); } catch (e) { console.warn("EVAL-BLOCKED " + e.name); }' +
      'fetch("x.json").then(() => console.warn("FETCH-RAN"), () => console.warn("FETCH-BLOCKED"));</script>');
    const text = [...bad.errors, ...bad.warnings].map((e) => e.text).join('\n');
    expect(text).toMatch(/EVAL-BLOCKED EvalError/);
    expect(text).not.toMatch(/EVAL-RAN|FETCH-RAN/);
    expect(text).toMatch(/connect-src 'none'/);
    expect(text).toMatch(/example\.com\/x\.png' violates/);
  }, 260000);

  it('is deterministic', async () => {
    const again = await compile(talkingPlan(), { outDir: path.join(tmp, 'out2'), assetsDir, ratio: '9:16' });
    expect(again.indexHtml).toBe(html);
  });
});
