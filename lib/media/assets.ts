import path from 'node:path';
import { existsSync } from 'node:fs';
import { repoPath } from '../root';

/** Bundled assets (CC0 SFX) live in the repo's `assets/`; a plan's `sfx/...` resolves there if `assetsDir` lacks it. */
export const BUNDLED_ASSETS = repoPath('assets');

/** A plan asset path normalised to posix and checked to stay inside `assetsDir` (no absolute paths, no `..`). */
export function normAsset(p: string): string {
  const n = path.posix.normalize(p.replace(/\\/g, '/'));
  if (path.posix.isAbsolute(n) || /^[a-zA-Z]:/.test(n) || n === '..' || n.startsWith('../')) {
    throw new Error(`asset path must be relative to assetsDir: ${p}`);
  }
  return n;
}

/** The file of plan asset `p`: `assetsDir` first, then the bundled assets. Throws a clear error if neither has it. */
export function resolveAsset(p: string, assetsDir: string): string {
  const rel = normAsset(p);
  for (const base of [assetsDir, BUNDLED_ASSETS]) {
    const f = path.join(base, ...rel.split('/'));
    if (existsSync(f)) return f;
  }
  throw new Error(`missing asset: ${rel} (looked in ${assetsDir} and ${BUNDLED_ASSETS})`);
}

/** True when plan asset `p` resolves (assetsDir or bundled). */
export function hasAsset(p: string, assetsDir: string): boolean {
  try {
    resolveAsset(p, assetsDir);
    return true;
  } catch {
    return false;
  }
}

/**
 * Sound cues whose file no longer exists are dropped: older versions still point at the retired sound packs, and a
 * missing click must not break their preview or render (`rf validate` still names it for new plans).
 */
export function withLiveSfx<P extends { sfx: { file: string }[] }>(plan: P, assetsDir: string): P {
  const sfx = plan.sfx.filter((c) => hasAsset(c.file, assetsDir));
  return sfx.length === plan.sfx.length ? plan : { ...plan, sfx };
}
