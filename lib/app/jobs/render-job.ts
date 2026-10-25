import os from 'node:os';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { run } from '@/lib/media/run';
import { renderLayered } from '@/lib/render/layered';
import { expectsAudio, qa, type QaReport } from '@/lib/render/qa';
import { RATIO_SIZE } from '@/lib/compile';
import { PROFILES, type RenderProfile } from '@/lib/render/profiles';
import type { Plan, Ratio } from '@/lib/plan';
import { writeJson } from '@/lib/app/workspace/files';
import { projectDir, versionDir } from '@/lib/app/workspace/paths';
import { readVersion } from '@/lib/app/workspace/store';
import { registerExecutor, type Emit } from './jobs';

export interface RenderDeps {
  renderLayered: typeof renderLayered;
  qa: (file: string, expect: Parameters<typeof qa>[1]) => Promise<QaReport>;
  thumbnail: (video: string, atSec: number, out: string) => Promise<void>;
  concurrency: number;
}

async function grabFrame(video: string, atSec: number, out: string): Promise<void> {
  await run('ffmpeg', ['-y', '-v', 'error', '-ss', atSec.toFixed(3), '-i', video, '-frames:v', '1', '-q:v', '1', out]);
}

export const defaultDeps = (): RenderDeps => ({
  renderLayered,
  qa,
  thumbnail: grabFrame,
  concurrency: Math.max(1, Math.floor(os.cpus().length / 4)),
});

const tag = (r: Ratio) => r.replace(':', 'x');

/** Runs `items` through `fn` with at most `limit` in flight. */
async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i]);
      }
    }),
  );
  return results;
}

/** Renders every ratio of a version in parallel; final renders are QA-gated per ratio. */
export async function runRenderJob(
  projectId: string,
  version: number,
  profile: RenderProfile,
  emit: Emit,
  deps: RenderDeps = defaultDeps(),
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
      const report = await deps.qa(out, {
        fps: plan.fps,
        frames: Math.round(plan.duration * plan.fps),
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
  });

  if (failed.length) throw new Error(`QA failed: ${failed.join(', ')}`);
  if (plan.selection.thumbnail) {
    const first = plan.ratios[0];
    const last = plan.scenes.at(-1);
    await deps.thumbnail(outputs[first], (last?.start ?? 0) + 0.5, path.join(outDir, `thumbnail-${tag(first)}.jpg`));
  }
  return { outputs };
}

registerExecutor('render', async ({ projectId, spec, emit }) => {
  const s = spec as unknown as { version: number; profile: RenderProfile };
  await runRenderJob(projectId, s.version, s.profile, emit);
  return 'done';
});

export type { Plan };
