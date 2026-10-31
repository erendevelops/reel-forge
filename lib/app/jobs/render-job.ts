import os from 'node:os';
import path from 'node:path';
import { mkdir, readdir, rm } from 'node:fs/promises';
import { run } from '@/lib/media/run';
import { withSignal } from '@/lib/media/cancel';
import { renderLayered } from '@/lib/render/layered';
import { expectsAudio, qa, type QaReport } from '@/lib/render/qa';
import { RATIO_SIZE, compile } from '@/lib/compile';
import { npx } from '@/lib/media/npx';
import { PROFILES, profilePlan, type RenderProfile } from '@/lib/render/profiles';
import type { Plan, Ratio } from '@/lib/plan';
import { writeJson } from '@/lib/app/workspace/files';
import { projectDir, versionDir } from '@/lib/app/workspace/paths';
import { readVersion } from '@/lib/app/workspace/store';
import { registerExecutor, type Emit } from './jobs';

export interface RenderDeps {
  renderLayered: typeof renderLayered;
  qa: (file: string, expect: Parameters<typeof qa>[1]) => Promise<QaReport>;
  thumbnail: (video: string, atSec: number, out: string) => Promise<void>;
  /** The designed cover (`plan.cover`) as a JPEG. */
  cover: (plan: Plan, ratio: Ratio, assetsDir: string, workDir: string, out: string) => Promise<void>;
  concurrency: number;
}

async function grabFrame(video: string, atSec: number, out: string): Promise<void> {
  await run('ffmpeg', ['-y', '-v', 'error', '-ss', atSec.toFixed(3), '-i', video, '-frames:v', '1', '-q:v', '1', out]);
}

async function snapshotCover(plan: Plan, ratio: Ratio, assetsDir: string, workDir: string, out: string): Promise<void> {
  await rm(workDir, { recursive: true, force: true, maxRetries: 5 });
  await compile(plan, { outDir: workDir, assetsDir, ratio, cover: true });
  const shots = path.join(workDir, 'shots');
  const [cmd, a] = npx(['-y', 'hyperframes@0.8.191', 'snapshot', workDir, '--at', String(plan.cover!.at), '--no-end', '--describe', 'false', '-o', shots]);
  await run(cmd, a, { timeoutMs: 5 * 60 * 1000 });
  const png = (await readdir(shots)).find((f) => f.endsWith('.png'));
  if (!png) throw new Error('cover snapshot wrote no image');
  await run('ffmpeg', ['-y', '-v', 'error', '-i', path.join(shots, png), '-q:v', '2', out]);
  await rm(workDir, { recursive: true, force: true, maxRetries: 5 }).catch(() => undefined);
}

export const defaultDeps = (): RenderDeps => ({
  renderLayered,
  qa,
  thumbnail: grabFrame,
  cover: snapshotCover,
  concurrency: Math.max(1, Math.floor(os.cpus().length / 4)),
});

const tag = (r: Ratio) => r.replace(':', 'x');

/**
 * Runs `items` through `fn` with at most `limit` in flight. Every started item settles before this returns, so a failed
 * item never releases the job while siblings still write files; the first error is rethrown afterwards.
 */
async function pool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>, signal?: AbortSignal): Promise<void> {
  let next = 0;
  let firstError: unknown = null;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length && firstError === null && !signal?.aborted) {
        const i = next++;
        try {
          await fn(items[i]);
        } catch (err) {
          firstError ??= err;
        }
      }
    }),
  );
  if (firstError !== null) throw firstError;
  if (signal?.aborted) throw new Error('cancelled');
}

/** Renders every ratio of a version in parallel; final renders are QA-gated per ratio. */
export async function runRenderJob(
  projectId: string,
  version: number,
  profile: RenderProfile,
  emit: Emit,
  deps: RenderDeps = defaultDeps(),
  signal?: AbortSignal,
): Promise<{ outputs: Record<Ratio, string> }> {
  return withSignal(signal, () => renderAll(projectId, version, profile, emit, deps, signal));
}

async function renderAll(
  projectId: string,
  version: number,
  profile: RenderProfile,
  emit: Emit,
  deps: RenderDeps,
  signal: AbortSignal | undefined,
): Promise<{ outputs: Record<Ratio, string> }> {
  const { plan } = await readVersion(projectId, version);
  const outDir = path.join(versionDir(projectId, version), 'render');
  await mkdir(outDir, { recursive: true });
  const assetsDir = path.join(projectDir(projectId), 'inputs');
  const failed: Ratio[] = [];
  const outputs = {} as Record<Ratio, string>;

  await pool(plan.ratios, deps.concurrency, async (ratio) => {
    const out = path.join(outDir, `${profile}-${tag(ratio)}.mp4`);
    emit({ type: 'progress', step: `${ratio} render` });
    const { base } = await deps.renderLayered(plan, {
      assetsDir,
      workDir: path.join(outDir, `work-${profile}-${tag(ratio)}`),
      out,
      ratio,
      profile,
    });
    if (PROFILES[profile].qa === 'full') {
      emit({ type: 'progress', step: `${ratio} qa` });
      const [width, height] = RATIO_SIZE[ratio];
      const fps = profilePlan(plan, profile).fps;
      const report = await deps.qa(out, {
        fps,
        frames: Math.round(plan.duration * fps),
        duration: plan.duration,
        width,
        height,
        lufs: -14,
        audio: expectsAudio(plan),
        lumaFile: base,
      });
      await writeJson(path.join(outDir, `qa-${profile}-${tag(ratio)}.json`), report);
      if (!report.pass) failed.push(ratio);
    }
    outputs[ratio] = out;
    emit({ type: 'progress', step: `${ratio} done` });
  }, signal);

  if (failed.length) throw new Error(`QA failed: ${failed.join(', ')}`);
  if (plan.selection.thumbnail) {
    const first = plan.ratios[0];
    const last = plan.scenes.at(-1);
    const file = path.join(outDir, `thumbnail-${tag(first)}.jpg`);
    const grab = () => deps.thumbnail(outputs[first], (last?.start ?? 0) + 0.5, file);
    if (plan.cover) {
      emit({ type: 'progress', step: 'cover' });
      // a cover that fails to build never fails the render: fall back to a plain frame
      await deps.cover(plan, first, assetsDir, path.join(outDir, `work-cover-${tag(first)}`), file).catch(grab);
    } else {
      await grab();
    }
  }
  return { outputs };
}

registerExecutor('render', async ({ projectId, spec, emit, signal }) => {
  const s = spec as unknown as { version: number; profile: RenderProfile };
  await runRenderJob(projectId, s.version, s.profile, emit, defaultDeps(), signal);
  return 'done';
});

export type { Plan };
