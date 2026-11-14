import { describe, expect, it } from 'vitest';
import { flashesIn } from '../../lib/media/flashes';
import { toolIcon } from '../../lib/compile/cards/icon';

describe('shot flashes', () => {
  it('flags a picture change right after the in point or right before the out point, once per edge', () => {
    expect(flashesIn([0.05, 0.13], 2.9)[0]).toMatch(/first 0.13 s: start it at least 0.18 s later/);
    expect(flashesIn([2.7, 2.8], 3.2)).toHaveLength(1);
    expect(flashesIn([2.7], 3.2)[0]).toMatch(/0.50 s before its end: end it at least 0.55 s earlier/);
  });

  it('flags a split-second different picture in the middle, but not a real cut or motion', () => {
    expect(flashesIn([1.5, 1.7], 4)[0]).toMatch(/flashes for 0.20 s/);
    expect(flashesIn([1.5], 4)).toEqual([]);
    expect(flashesIn([], 4)).toEqual([]);
  });
});

describe('list rows without a logo', () => {
  it('draw no empty tile', () => {
    const ctx = { width: 1080, height: 1920, fps: 30, ratio: '9:16' as const, assetsUrl: (p: string) => p };
    expect(toolIcon(ctx, undefined, 46, 'x')).toBe('');
    expect(toolIcon(ctx, 'ext/a.png', 46, 'x')).toContain('<img');
  });
});
