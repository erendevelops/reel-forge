/**
 * The lasting preference Claude proposes at the end of a revise reply (video-core rules.md: one line
 * `PREFERENCE: <rule>`), or null. The last such line wins.
 */
export function extractPreference(text: string): string | null {
  const all = [...text.matchAll(/^PREFERENCE:\s*(.+?)\s*$/gm)];
  return all.length ? all[all.length - 1][1] : null;
}
