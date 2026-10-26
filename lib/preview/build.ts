import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { compile } from '@/lib/compile';
import type { Ratio } from '@/lib/plan';
import { projectDir } from '@/lib/app/workspace/paths';
import { validateForProject } from '@/lib/app/workspace/store';
import { PLAYER_JS } from './player-script';

export const ratioTag = (r: Ratio) => r.replace(':', 'x');

/**
 * Compiles a (possibly unsaved) plan for one ratio into `<project>/.preview/<tag>/` with the player script added, and
 * returns the URL the preview route serves it at. Throws the validation errors for a plan the project doesn't allow.
 */
export async function buildPreview(id: string, plan: unknown, ratio: Ratio): Promise<{ url: string; key: string }> {
  const r = await validateForProject(id, plan);
  if (!r.ok) throw new Error(r.errors.join('\n'));
  const tag = ratioTag(ratio);
  const outDir = path.join(projectDir(id), '.preview', tag);
  await compile(r.plan, { outDir, assetsDir: path.join(projectDir(id), 'inputs'), ratio });
  await writeFile(path.join(outDir, 'assets', 'player.js'), PLAYER_JS, 'utf8');
  const index = path.join(outDir, 'index.html');
  const html = await readFile(index, 'utf8');
  await writeFile(index, html.replace('</body>', '<script src="assets/player.js"></script>\n</body>'), 'utf8');
  const key = createHash('sha1').update(JSON.stringify(r.plan)).update(ratio).digest('hex').slice(0, 12);
  return { url: `/api/projects/${id}/preview/${tag}/index.html?k=${key}`, key };
}
