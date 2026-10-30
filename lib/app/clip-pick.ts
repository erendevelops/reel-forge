import { createHash } from 'node:crypto';
import { access, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { RATIO_SIZE } from '@/lib/compile';
import { prepareClip } from '@/lib/media/prepare';
import { run } from '@/lib/media/run';
import type { Ratio } from '@/lib/plan/schema';
import { projectDir } from './workspace/paths';

/** A video the analysis described, with its moments as start seconds the picker offers. */
export type ClipSource = { file: string; duration: number; content: string; moments: { at: number; what: string }[] };

/** The project's videos from `analysis/clips.json` (empty before the analysis). */
export async function clipSources(id: string): Promise<ClipSource[]> {
  const raw = await readFile(path.join(projectDir(id), 'analysis', 'clips.json'), 'utf8').catch(() => null);
  if (!raw) return [];
  let list: unknown;
  try {
    list = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(list)) return [];
  return list
    .filter((c): c is { file: string; duration?: number; content?: string; moments?: { at?: unknown; what?: unknown }[] } => typeof c?.file === 'string' && c.file.startsWith('inputs/'))
    .map((c) => ({
      file: c.file,
      duration: typeof c.duration === 'number' ? c.duration : 0,
      content: typeof c.content === 'string' ? c.content : '',
      moments: (Array.isArray(c.moments) ? c.moments : [])
        .map((m) => ({ at: Number.parseFloat(String(m.at)), what: String(m.what ?? '') }))
        .filter((m) => Number.isFinite(m.at)),
    }));
}

export class PickError extends Error {}

/**
 * Cuts `duration` seconds of an input video from `from` into a working clip at the output size (as `rf prep` does);
 * the same pick reuses its file. Returns the clip's project-relative path for a `shot-clip` edit.
 */
export async function cutPick(id: string, o: { src: string; from: number; duration: number; ratio: Ratio; fps: 30 | 60 }): Promise<string> {
  const sources = await clipSources(id);
  if (!sources.some((s) => s.file === o.src)) throw new PickError(`${o.src} is not one of the project's videos`);
  if (!(o.from >= 0) || !(o.duration > 0)) throw new PickError('start must be ≥ 0 and length > 0');
  const key = createHash('sha1').update(JSON.stringify(o)).digest('hex').slice(0, 10);
  const rel = `work/pick-${key}.mp4`;
  const out = path.join(projectDir(id), 'inputs', 'work', `pick-${key}.mp4`); // shot sources live under inputs/
  if (await access(out).then(() => true, () => false)) return rel;
  await mkdir(path.dirname(out), { recursive: true });
  const [width, height] = RATIO_SIZE[o.ratio];
  await prepareClip(path.join(projectDir(id), ...o.src.split('/')), out, { from: o.from, duration: o.duration, width, height, fps: o.fps });
  return rel;
}

/** A small JPEG of an input video at `t` seconds (cached), so the picker shows what a start point looks like. */
export async function framePath(id: string, src: string, t: number): Promise<string> {
  const sources = await clipSources(id);
  if (!sources.some((s) => s.file === src)) throw new PickError(`${src} is not one of the project's videos`);
  if (!(t >= 0)) throw new PickError('time must be ≥ 0');
  const key = createHash('sha1').update(`${src}@${t.toFixed(2)}`).digest('hex').slice(0, 12);
  const out = path.join(projectDir(id), '.preview', 'frames', `${key}.jpg`);
  if (await access(out).then(() => true, () => false)) return out;
  await mkdir(path.dirname(out), { recursive: true });
  await run('ffmpeg', ['-y', '-v', 'error', '-ss', String(t), '-i', path.join(projectDir(id), ...src.split('/')), '-frames:v', '1', '-vf', 'scale=320:-2', '-q:v', '4', out]);
  return out;
}
