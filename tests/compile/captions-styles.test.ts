import { describe, expect, it } from 'vitest';
import { renderCaptions } from '../../lib/compile/captions';
import type { CompileContext } from '../../lib/compile/types';

const ctx: CompileContext = { width: 1080, height: 1920, fps: 30, ratio: '9:16', assetsUrl: (p) => p };

describe('caption styles', () => {
  it('one-word shows only the current word, cutting at each word start', () => {
    const f = renderCaptions({ style: 'one-word', groups: [{ words: [['Devlet', 1], ['geri', 1.4]], end: 2 }] }, ctx);
    expect(f.html).toContain('>Devlet<');
    expect(f.html).toContain('>geri<');
    expect(f.timeline).toContain('tl.set("#cap-1-w1", { display: "block" }, 1);');
    expect(f.timeline).toContain('tl.set("#cap-1-w1", { display: "none" }, 1.4);');
    expect(f.timeline).toContain('tl.set("#cap-1-w2", { display: "block" }, 1.4);');
    expect(f.css).toMatch(/paint-order: stroke fill/);
    expect(f.css).toContain('#FFD21F');
  });

  it('serif-small renders *emphasis* as italic without the asterisks', () => {
    const f = renderCaptions({ style: 'serif-small', groups: [{ words: [['işi', 1], ['*masaya*', 1.3], ['bırak', 1.6]], end: 2.2 }] }, ctx);
    expect(f.html).toContain('<em>masaya</em>');
    expect(f.html).not.toContain('*');
    expect(f.css).toMatch(/serif/);
  });
});
