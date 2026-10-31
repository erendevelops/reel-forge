import { createHash } from 'node:crypto';
import { link, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { compile } from '@/lib/compile';
import { SelectionSchema, type Ratio, type Selection } from '@/lib/plan';
import { projectDir } from '@/lib/app/workspace/paths';
import { validateForProject } from '@/lib/app/workspace/store';
import { PLAYER_JS } from './player-script';

export const ratioTag = (r: Ratio) => r.replace(':', 'x');

/** Builds kept per ratio; older ones are removed (a slow, superseded build may still be loading one). */
const KEEP = 4;

async function prune(root: string, tag: string): Promise<void> {
  const names = (await readdir(root).catch(() => [] as string[])).filter((n) => n.startsWith(`${tag}-`));
  const dated = await Promise.all(names.map(async (n) => ({ n, t: (await stat(path.join(root, n)).catch(() => null))?.mtimeMs ?? 0 })));
  for (const { n } of dated.sort((a, b) => b.t - a.t).slice(KEEP)) await rm(path.join(root, n), { recursive: true, force: true });
}

const MEDIA = /\.(mp4|mov|webm|wav|mp3|m4a|ogg|flac|png|jpe?g|webp)$/i;

/**
 * Hard-links the media of the newest other build into `outDir/assets`, so the compiler (which skips a copy whose
 * size and date already match) doesn't copy the footage again for every edit. Best effort: a failed link just copies.
 */
async function reuseMedia(root: string, tag: string, outDir: string): Promise<void> {
  const others = (await readdir(root).catch(() => [] as string[])).filter((n) => n.startsWith(`${tag}-`) && path.join(root, n) !== outDir);
  const dated = await Promise.all(others.map(async (n) => ({ n, t: (await stat(path.join(root, n)).catch(() => null))?.mtimeMs ?? 0 })));
  const prev = dated.sort((a, b) => b.t - a.t)[0];
  if (!prev) return;
  const from = path.join(root, prev.n, 'assets');
  const files = ((await readdir(from, { recursive: true }).catch(() => [])) as string[]).filter((f) => MEDIA.test(f));
  for (const f of files) {
    const dest = path.join(outDir, 'assets', f);
    await mkdir(path.dirname(dest), { recursive: true });
    await link(path.join(from, f), dest).catch(() => undefined);
  }
}

/**
 * Compiles a (possibly unsaved) plan for one ratio into `<project>/.preview/<tag>-<key>/` with the player script
 * added, and returns the URL the preview route serves it at. Each plan gets its own folder, so a slow build can never
 * overwrite a newer one. Throws the validation errors for a plan the project doesn't allow.
 */
export async function buildPreview(id: string, plan: unknown, ratio: Ratio): Promise<{ url: string; key: string }> {
  const own = (plan as { selection?: Selection } | null)?.selection;
  const r = await validateForProject(id, plan, SelectionSchema.safeParse(own).success ? own : undefined);
  if (!r.ok) throw new Error(r.errors.join('\n'));
  const tag = ratioTag(ratio);
  const key = createHash('sha1').update(JSON.stringify(r.plan)).update(ratio).digest('hex').slice(0, 12);
  const root = path.join(projectDir(id), '.preview');
  const outDir = path.join(root, `${tag}-${key}`);
  await reuseMedia(root, tag, outDir);
  await compile(r.plan, { outDir, assetsDir: path.join(projectDir(id), 'inputs'), ratio });
  await writeFile(path.join(outDir, 'assets', 'player.js'), PLAYER_JS, 'utf8');
  const index = path.join(outDir, 'index.html');
  const html = await readFile(index, 'utf8');
  await writeFile(index, html.replace('</body>', '<script src="assets/player.js"></script>\n</body>'), 'utf8');
  await prune(root, tag);
  return { url: `/api/projects/${id}/preview/${tag}-${key}/index.html`, key };
}
