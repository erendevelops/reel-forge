import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { projectDir, versionDir } from './workspace/paths';
import type { Project, VersionOrigin } from './workspace/schema';

/** Which screen a project is on (spec §3: inputs → option cards → transcript check → storyboard → render → review). */
export type Stage = 'cards' | 'analyse' | 'transcript' | 'music' | 'plan' | 'storyboard' | 'review';

export function projectStage(p: Project, s: { analysed: boolean; versions: VersionOrigin[]; rendered: boolean }): Stage {
  // projects planned before these flags existed go straight to their versions
  if (s.versions.length) return s.rendered ? 'review' : 'storyboard';
  if (!p.cardsConfirmed) return 'cards';
  if (!s.analysed) return 'analyse';
  if (p.mode === 'reel' && !p.transcriptChecked) return 'transcript';
  if (p.selection?.music && !p.music?.file) return 'music';
  return 'plan';
}

const exists = (f: string) => stat(f).then(() => true, () => false);

/** What the analyse stage left in `analysis/`. */
export async function analysisState(id: string): Promise<{ analysed: boolean; transcriptFile: string | null; musicCandidates: boolean }> {
  const dir = path.join(projectDir(id), 'analysis');
  const names = await readdir(dir).catch(() => [] as string[]);
  const transcriptFile = names.includes('transcript-trimmed.json') ? 'analysis/transcript-trimmed.json' : names.includes('transcript.json') ? 'analysis/transcript.json' : null;
  return { analysed: names.length > 0, transcriptFile, musicCandidates: names.includes('music-candidates.json') };
}

/** A final render exists for version `n`. */
export async function hasFinalRender(id: string, n: number): Promise<boolean> {
  const dir = path.join(versionDir(id, n), 'render');
  const names = await readdir(dir).catch(() => [] as string[]);
  return names.some((f) => /^final-.*\.mp4$/.test(f)) && (await exists(dir));
}
