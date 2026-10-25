import { describe, expect, it } from 'vitest';
import { validateMusicCandidates } from '../../lib/plan/music';

const c = (i: number, over: Record<string, unknown> = {}) => ({
  title: `Track ${i}`, artist: 'A', url: `https://pixabay.com/music/t-${i}/`, license: 'Pixabay Content License', why: 'minimal build', ...over,
});

describe('music candidates', () => {
  it('music candidates need 3–4 https entries', () => {
    expect(validateMusicCandidates({ candidates: [c(1), c(2), c(3)] }).ok).toBe(true);
    expect(validateMusicCandidates({ candidates: [c(1), c(2)] }).ok).toBe(false);
    expect(validateMusicCandidates({ candidates: [c(1), c(2), c(3), c(4), c(5)] }).ok).toBe(false);
    expect(validateMusicCandidates({ candidates: [c(1), c(2), c(3, { url: 'http://x.test/a' })] }).ok).toBe(false);
  });

  it('music candidates require license text', () => {
    const r = validateMusicCandidates({ candidates: [c(1), c(2), c(3, { license: '' })] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join('\n')).toMatch(/license/);
  });
});
