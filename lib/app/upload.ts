/** Folders never imported: dependencies, VCS data and build output (an app's code folder can be gigabytes of these). */
export const SKIP_DIRS = new Set(['node_modules', '.git', '.next', 'dist', 'build', 'out', '.turbo', '.cache', 'coverage', '.expo', 'Pods', 'DerivedData', '.gradle', '__pycache__', '.venv', 'venv']);

/** True when a relative path runs through a folder that is never imported. */
export function isSkipped(rel: string): boolean {
  return rel.split(/[\\/]+/).some((p) => SKIP_DIRS.has(p));
}

/**
 * A browser-supplied relative path (`file.webkitRelativePath` or a name) made safe for `inputs/`: `/`-separated,
 * no empty, `.`/`..` or drive parts, no leading slash. Returns null when nothing usable is left.
 */
export function safeRelPath(rel: string): string | null {
  const parts = rel
    .split(/[\\/]+/)
    .filter((p) => !/^[a-zA-Z]:$/.test(p))
    .map((p) => p.replace(/[<>:"|?*\u0000-\u001f]/g, '').trim())
    .filter((p) => p && p !== '.' && p !== '..');
  return parts.length ? parts.join('/') : null;
}
