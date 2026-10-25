import { createRequire } from 'node:module';
import path from 'node:path';

/**
 * Repo root for bundled files (assets/, tools/, node_modules). The app, the tests and the scripts all run from the
 * repo root; `import.meta.url` can't be used because Next bundles server code into .next/.
 */
export const REPO_ROOT = process.env.REELFORGE_ROOT ?? process.cwd();

export const repoPath = (...p: string[]) => path.join(REPO_ROOT, ...p);

/** require() resolving from the repo root (for JSON/data files inside node_modules packages). */
export const repoRequire = createRequire(path.join(REPO_ROOT, 'package.json'));
