import { describe, it, expect } from 'vitest';
import { checkFragment, namespaceFragment } from '../../lib/plan/fragment';
import { validatePlan } from '../../lib/plan';
import { cardRegistry } from '../../lib/compile/cards';

const ctx = { width: 1080, height: 1920, fps: 60, ratio: '9:16' as const, assetsUrl: (p: string) => `assets/${p}` };

/** A growing bar chart fragment, card-relative times. */
const GOOD = {
  html: '<svg viewBox="0 0 100 60" class="chart"><defs><linearGradient id="g"><stop offset="0" stop-color="#16A34A"/></linearGradient></defs>' +
    '<rect id="bar" class="bar tall" x="10" y="0" width="20" height="60" fill="url(#g)"/></svg><div id="n" class="num">0</div>',
  css: '.chart { width: 80%; } #bar { transform-origin: 50% 100%; } .num, svg rect { font-size: 64px; color: rgba(0,0,0,0.8); }',
  timeline: [
    '// grow the bar, then count',
    'tl.fromTo("#bar", { scaleY: 0 }, { scaleY: 1, duration: 0.8, ease: "power2.out" }, 0.2);',
    "tl.to('.num', { textContent: 42, snap: { textContent: 1 }, duration: 1 }, 1);",
    'tl.set("svg rect", { opacity: 1 }, 2.5);',
  ].join('\n'),
  label: 'bar grows to 42',
};

function planWith(card: Record<string, unknown>, topicAssets: boolean | undefined, extraCards: string[] = []) {
  return {
    version: 1, mode: 'reel', fps: 60, duration: 4, ratios: ['9:16'],
    selection: {
      captions: 'none', layouts: ['split'], cards: ['custom-animation', ...extraCards], sfx: false, music: false, punchIns: false, thumbnail: false,
      ...(topicAssets === undefined ? {} : { topicAssets }),
    },
    scenes: [{ id: 'explain', start: 0, end: 4, say: 'x', why: 'x', layout: 'split', shots: [], cards: [card] }],
    captions: { style: 'none', groups: [] }, sfx: [],
  };
}
const caCard = (params: unknown, start = 1, end = 4) => ({ type: 'custom-animation', start, end, params });

describe('custom-animation fragment rules', () => {
  it('accepts a valid fragment', () => {
    expect(checkFragment(GOOD, 3)).toEqual([]);
    // CSS keys and grouping parens are not banned identifiers/calls
    expect(checkFragment({ ...GOOD, timeline: 'const w = (2 + 1) * 10;\ntl.to("#bar", { top: w, left: "rgba(0,0,0,1)" }, 0);' }, 3)).toEqual([]);
  });

  const bad: [string, Partial<typeof GOOD>, RegExp][] = [
    ['tl.from', { timeline: 'tl.from("#bar", { opacity: 0 }, 0);' }, /from\(/],
    ['Date', { timeline: 'tl.set("#bar", { x: Date.now() % 10 }, 0);' }, /Date/],
    ['Math.random', { timeline: 'tl.set("#bar", { x: Math.random() }, 0);' }, /Math\.random/],
    ['setTimeout', { timeline: 'setTimeout(() => 0, 10);' }, /setTimeout/],
    ['fetch', { timeline: 'fetch("/x");' }, /fetch/],
    ['<script in html', { html: '<div></div><script>tl.set()</script>' }, /<script/],
    ['http URL in html', { html: '<img src="http://example.com/a.png">' }, /external URL/],
    ['https URL in css', { css: '.a { background: url(https://example.com/a.png); }' }, /external URL/],
    ['other callee', { timeline: 'gsap.to("#bar", { x: 1 }, 0);' }, /only tl\.fromTo/],
    ['chained call', { timeline: 'tl.to("#bar", { x: 1 }, 0).to("#bar", { x: 2 }, 1);' }, /only tl\.fromTo/],
    ['missing position', { timeline: 'tl.to("#bar", { x: 1 });' }, /position/],
    ['non-literal target', { timeline: 'const s = "#bar"; tl.to(s, { x: 1 }, 0);' }, /target/],
    ['callback', { timeline: 'tl.to("#bar", { x: 1, onUpdate: () => 0 }, 0);' }, /=>/],
    ['document', { timeline: 'tl.set("#bar", { x: document.body }, 0);' }, /document/],
    ['inline handler', { html: '<div onclick="x"></div>' }, /handler/],
    ['css at-rule', { css: '@keyframes k { from { opacity: 0 } }' }, /@/],
    ['css transition', { css: '.a { transition: opacity 1s; }' }, /transition|animation/],
    ['tl misuse', { timeline: 'tl.vars.x = 1;' }, /tl may only/],
    ['nested call', { timeline: 'if (1) { tl.set("#bar", { x: 1 }, 0); }' }, /top-level/],
    ['past the card', { timeline: 'tl.set("#bar", { x: 1 }, 3.5);' }, /after the card/],
  ];
  for (const [name, patch, msg] of bad) {
    it(`rejects ${name}`, () => {
      const errs = checkFragment({ ...GOOD, ...patch }, 3);
      expect(errs.length, name).toBeGreaterThan(0);
      expect(errs.join('\n')).toMatch(msg);
    });
  }
});

describe('custom-animation namespacing and timing', () => {
  const f = namespaceFragment(GOOD, 'explain-custom-animation-1', 10);

  it('namespaces ids and classes per card, in html, css and timeline targets', () => {
    expect(f.html).toContain('id="explain-custom-animation-1-bar"');
    expect(f.html).toContain('class="explain-custom-animation-1-bar explain-custom-animation-1-tall"');
    expect(f.html).toContain('fill="url(#explain-custom-animation-1-g)"');
    expect(f.html).not.toMatch(/id="bar"|class="num"/);
    expect(f.css).toContain('#explain-custom-animation-1 .explain-custom-animation-1-chart {');
    expect(f.css).toContain('#explain-custom-animation-1 .explain-custom-animation-1-num, #explain-custom-animation-1 svg rect {');
    expect(f.css).toContain('rgba(0,0,0,0.8)');
    expect(f.timeline).toContain('tl.fromTo("#explain-custom-animation-1 #explain-custom-animation-1-bar", { scaleY: 0 }');
    expect(f.timeline).toContain('tl.to("#explain-custom-animation-1 .explain-custom-animation-1-num"');
    // values are untouched (ease "power2.out" is not a class)
    expect(f.timeline).toContain('ease: "power2.out"');
  });

  it('offsets card-relative times to absolute', () => {
    expect(f.timeline).toMatch(/power2\.out" \}, 10\.2\);/);
    expect(f.timeline).toMatch(/duration: 1 \}, 11\);/);
    expect(f.timeline).toMatch(/\{ opacity: 1 \}, 12\.5\);/);
    expect(f.timeline).not.toContain('// grow');
  });

  it('two cards with the same fragment do not collide', () => {
    const g = namespaceFragment(GOOD, 'outro-custom-animation-1', 0);
    expect(g.html).toContain('id="outro-custom-animation-1-bar"');
    expect(g.html).not.toContain('explain-custom-animation-1');
  });

  it('is deterministic', () => {
    expect(namespaceFragment(GOOD, 'explain-custom-animation-1', 10)).toEqual(f);
    const card = { type: 'custom-animation' as const, start: 1, end: 4, params: GOOD };
    const a = cardRegistry['custom-animation'].render(card, 'c-custom-animation-1', { ...ctx, region: { x: 0, y: 0, w: 1080, h: 960 } });
    const b = cardRegistry['custom-animation'].render(card, 'c-custom-animation-1', { ...ctx, region: { x: 0, y: 0, w: 1080, h: 960 } });
    expect(a).toEqual(b);
    // sits in the card region, as a timed clip
    expect(a.html).toMatch(/^<div id="c-custom-animation-1" class="clip talking custom-animation" data-start="1" data-duration="3" style="left: 0px; top: 0px; width: 1080px; height: 960px;"/);
    expect(a.html).toContain('data-label="bar grows to 42"');
    expect(a.timeline).toContain(', 1.2);');
  });
});

describe('validatePlan: topic assets', () => {
  it('selection.topicAssets defaults to false', () => {
    const v = validatePlan(planWith(caCard(GOOD), undefined));
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.errors.join('\n')).toMatch(/custom-animation requires selection\.topicAssets/);
  });

  it('accepts custom-animation with topicAssets', () => {
    const v = validatePlan(planWith(caCard(GOOD), true));
    expect(v.ok, v.ok ? '' : v.errors.join('\n')).toBe(true);
    if (v.ok) expect(v.plan.selection.topicAssets).toBe(true);
  });

  it('rejects a bad fragment with the card position in the message', () => {
    const v = validatePlan(planWith(caCard({ ...GOOD, timeline: 'tl.from("#bar", {}, 0);' }), true));
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.errors.join('\n')).toMatch(/scene explain card\[0\] \(custom-animation\):.*from\(/);
  });

  it('si: logo references need topicAssets and must resolve', () => {
    const logo = (img: string) => ({ type: 'logo-pop', start: 0, end: 2, params: { img, left: 100, top: 100 } });
    const p = (img: string, ta: boolean) => planWith(logo(img), ta, ['logo-pop']);
    expect(validatePlan(p('si:claude', true)).ok).toBe(true);
    const off = validatePlan(p('si:claude', false));
    expect(off.ok).toBe(false);
    if (!off.ok) expect(off.errors.join('\n')).toMatch(/topicAssets/);
    const unknown = validatePlan(p('si:definitely-not-a-brand', true));
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.errors.join('\n')).toMatch(/unknown logo/);
    // a user-supplied file is not a topic asset
    expect(validatePlan(p('ext/logo.png', false)).ok).toBe(true);
  });
});
