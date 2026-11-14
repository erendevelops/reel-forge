import type { Plan } from '../plan';
import { resolveAsset } from './assets';
import { run } from './run';

/** A picture change shorter than this at a shot's edge (or between two changes) reads as a glitch, not a cut. */
export const FLASH_S = 0.6;
// low on purpose: the change is often only on a monitor that fills a third of the frame (0.15 there)
const SCENE = 0.12;

/** Times (seconds from `from`) where the picture changes hard inside `file` between `from` and `to`. */
export async function sceneChanges(file: string, from: number, to: number): Promise<number[]> {
  const r = await run('ffmpeg', [
    '-hide_banner', '-nostats', '-ss', String(from), '-t', String(to - from), '-i', file,
    '-an', '-vf', `scale=160:-2,select='gt(scene,${SCENE})',showinfo`, '-f', 'null', '-',
  ], { timeoutMs: 2 * 60 * 1000 });
  return [...r.stderr.matchAll(/pts_time:([\d.]+)/g)].map((m) => Number(m[1]));
}

/** Pure part: which changes inside a shot of length `len` are flashes, and what to do about each. */
export function flashesIn(changes: number[], len: number): string[] {
  const out: string[] = [];
  const cs = [...changes].sort((a, b) => a - b);
  const head = cs.filter((c) => c < FLASH_S).at(-1);
  const tail = cs.find((c) => c >= FLASH_S && len - c < FLASH_S);
  if (head !== undefined) out.push(`a different picture shows for its first ${head.toFixed(2)} s: start it at least ${(head + 0.05).toFixed(2)} s later`);
  if (tail !== undefined) out.push(`the picture changes ${(len - tail).toFixed(2)} s before its end: end it at least ${(len - tail + 0.05).toFixed(2)} s earlier`);
  for (let i = 1; i < cs.length; i++) {
    if (cs[i] - cs[i - 1] < FLASH_S && cs[i - 1] >= FLASH_S && len - cs[i] >= FLASH_S) {
      out.push(`a different picture flashes for ${(cs[i] - cs[i - 1]).toFixed(2)} s at ${cs[i - 1].toFixed(2)} s into it: split the shot around it or pick another part`);
    }
  }
  return out;
}

/**
 * Shots whose cut lands next to a change on screen: the viewer sees another picture for a split second and then
 * the intended one (a monitor switching games, a camera bump). Checked on the real footage with ffmpeg.
 */
export async function shotFlashes(plan: Plan, assetsDir: string): Promise<string[]> {
  const errors: string[] = [];
  for (const s of plan.scenes) {
    for (const [i, sh] of s.shots.entries()) {
      if (!/\.(mp4|mov|m4v|webm|mkv)$/i.test(sh.src)) continue;
      let file: string;
      try {
        file = resolveAsset(sh.src, assetsDir);
      } catch {
        continue; // a missing file is reported elsewhere
      }
      const changes = await sceneChanges(file, sh.from, sh.to).catch(() => []);
      for (const f of flashesIn(changes, sh.to - sh.from)) errors.push(`scene ${s.id} shot ${i + 1} (${sh.src} ${sh.from}–${sh.to}): ${f}`);
    }
  }
  return errors;
}
