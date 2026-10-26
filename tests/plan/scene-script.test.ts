import { describe, expect, it } from 'vitest';
import { checkFragment, checkScript } from '../../lib/plan/fragment';
import { customAnimation } from '../../lib/compile/cards/custom-animation';

const ctx = { width: 1080, height: 1920, fps: 30, ratio: '9:16' as const, assetsUrl: (p: string) => p, kit: { accent: '#FFB800' } };

describe('scene scripts', () => {
  it('allows loops, arithmetic, DOM building and the helpers', () => {
    const src = `
      const flags = ['us', 'gb', 'ca'];
      for (let i = 0; i < flags.length; i++) {
        const el = document.createElement('div');
        el.className = 'flag f-' + flags[i];
        stage.appendChild(el);
        tl.fromTo(el, { x: -40, opacity: 0 }, { x: 0, opacity: 1, duration: 0.4, ease: 'expo.out' }, 0.2 + i * 0.12);
      }
      count('#total', 0, 700000, 0.5, 1.2, { suffix: ' ₺' });
      type('.title', 'Dijital Ürün', 1, 20);
      tl.set($$('.flag'), { rotation: rand() * 4 - 2 }, 0);
      const c = gsap.utils.clamp(0, 1, 2);`;
    expect(checkScript(src)).toEqual([]);
  });

  it('refuses the clock, random, timers, network, globals, callbacks and the global timeline', () => {
    for (const bad of [
      'const t = Date.now();',
      'const r = Math.random();',
      'setTimeout(() => {}, 10);',
      "fetch('x');",
      'window.x = 1;',
      "document.querySelector('#face').remove();",
      "tl.to('.a', { x: 1, onUpdate: () => {} }, 0);",
      "gsap.to('.a', { x: 1 });",
      'const s = "</script>";',
      "eval('1');",
    ]) expect(checkScript(bad), bad).not.toEqual([]);
    expect(checkScript('for (let i = 0; i < ; i++) {}')[0]).toMatch(/^script: /);
  });

  it('compiles a script card into a seekable, card-scoped block', () => {
    const card = { type: 'custom-animation' as const, start: 2, end: 6, params: { html: '<div id="total">0</div><div class="title"></div>', css: '.title { font-size: 80px; }', script: "count('#total', 0, 100, 0.5, 1); tl.fromTo('.title', { y: 40 }, { y: 0, duration: 0.5 }, 0.1);" } };
    expect(checkFragment(card.params, 4)).toEqual([]);
    const f = customAnimation.render(card, 'sc-custom-animation-1', ctx);
    expect(f.html).toContain('id="sc-custom-animation-1-total"');
    expect(f.html).toContain('class="title"'); // classes stay as written for scripts
    expect(f.css).toContain('#sc-custom-animation-1 .title { font-size: 80px; }');
    expect(f.timeline).toContain('const S = 2, D = 4');
    expect(f.timeline).toContain('"accent":"#FFB800"');
    expect(() => new Function('tl', 'document', f.timeline)).not.toThrow();
  });
});
