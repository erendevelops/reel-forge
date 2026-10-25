import { describe, it, expect } from 'vitest';
import { PUNCH, PUNCH_SETTLE, punchSpring, punchScaleExpr } from '../../lib/compile/punch';

describe('punch spring (v5 Reel.tsx: spring({ damping: 40, stiffness: 120 }) × 0.08)', () => {
  it('follows Remotion spring() values', () => {
    // sampled from remotion@4 `spring({ frame, fps: 60, config: { damping: 40, stiffness: 120 } })` in ../video/reel
    const remotion: [number, number][] = [[0.05, 0.105006], [0.1, 0.299303], [0.25, 0.758261], [0.5, 0.972919], [0.75, 0.997509], [1, 0.999791]];
    for (const [t, v] of remotion) expect(punchSpring(t)).toBeCloseTo(v, 5);
    expect(punchSpring(0)).toBe(0);
    expect(punchSpring(-1)).toBe(0);
  });

  it('settles in ≈ 0.845 s (Remotion measureSpring threshold 0.001 = 51 frames at 60 fps)', () => {
    expect(PUNCH_SETTLE).toBeGreaterThan(50 / 60);
    expect(PUNCH_SETTLE).toBeLessThan(51 / 60);
    expect(1 - punchSpring(PUNCH_SETTLE)).toBeLessThanOrEqual(1e-3 + 1e-9);
    expect(PUNCH.amount).toBe(0.08);
  });

  it('ffmpeg expression has no double minus and encodes the offset', () => {
    const e = punchScaleExpr(0.5);
    expect(e).not.toContain('--');
    expect(e).toContain('max(t-0.5,0)');
    // evaluate it as JS to check it is the same curve
    const js = (t: number) => new Function('t', 'max', 'exp', `return ${e};`)(t, Math.max, Math.exp) as number;
    for (const t of [0, 0.5, 0.6, 0.75, 1.5]) expect(js(t)).toBeCloseTo(1 + 0.08 * punchSpring(t - 0.5), 7);
  });
});
