import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { repoPath, repoRequire } from '../../lib/root';

describe('repo root helpers', () => {
  it('repoRequire resolves package files and repoPath finds bundled assets', () => {
    expect(existsSync(repoRequire.resolve('gsap/dist/gsap.min.js'))).toBe(true);
    expect(existsSync(repoPath('assets', 'sfx'))).toBe(true);
  });
});
