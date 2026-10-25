import { describe, expect, it } from 'vitest';
import { checkFragment, namespaceFragment } from '../../lib/plan/fragment';

const frag = (html: string) => ({ html, css: '', timeline: '' });

describe('custom-animation images', () => {
  it('allows <img> with a relative asset path (outro screenshot fan)', () => {
    expect(checkFragment(frag('<img class="shot" src="shots/home.jpg" alt="Home"/>'))).toEqual([]);
  });

  it('rejects images outside the inputs or with external sources', () => {
    for (const bad of ['../secret.png', '/etc/x.png', 'data:image/png;base64,AAAA', 'shots/home.exe', '']) {
      expect(checkFragment(frag(`<img src="${bad}"/>`)).length, bad).toBeGreaterThan(0);
    }
  });

  it('rewrites img src through the compiler asset resolver', () => {
    const out = namespaceFragment(frag('<img class="shot" src="shots/home.jpg"/>'), 'c1', 0, (p) => `assets/${p}`);
    expect(out.html).toContain('src="assets/shots/home.jpg"');
    expect(out.html).toContain('class="c1-shot"');
  });
});
