import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createProject, saveVersion } from '../../lib/app/workspace/store';
import { versionDir } from '../../lib/app/workspace/paths';
import { runRenderJob, type RenderDeps } from '../../lib/app/jobs/render-job';
import type { JobEvent } from '../../lib/app/jobs/jobs';

const fixture = JSON.parse(await readFile(path.join(__dirname, '../fixtures/plan-reel-v5.json'), 'utf8'));
let ws: string;
beforeEach(async () => {
  ws = await mkdtemp(path.join(os.tmpdir(), 'rf-render-'));
  process.env.REELFORGE_WORKSPACE = ws;
});
afterEach(async () => {
  delete process.env.REELFORGE_WORKSPACE;
  await rm(ws, { recursive: true, force: true });
});

function fakeDeps(o: { failRatio?: string; log: { ratio: string; start: number; end: number; profile?: string }[] }): RenderDeps {
  return {
    concurrency: 2,
    renderLayered: async (_plan, opts) => {
      const start = Date.now();
      await new Promise((r) => setTimeout(r, 150));
      await (await import('node:fs/promises')).writeFile(opts.out, 'mp4');
      o.log.push({ ratio: opts.ratio, start, end: Date.now(), profile: opts.profile });
      return { base: path.join(opts.workDir, 'base.mkv') };
    },
    qa: async (file) => ({
      pass: !(o.failRatio && file.includes(o.failRatio.replace(':', 'x'))),
      checks: [{ name: 'format', pass: true, detail: '' }],
    }),
    thumbnail: async () => undefined,
  };
}

async function setup(ratios: ('9:16' | '4:5' | '1:1')[]) {
  const p = await createProject({ name: 'Render', mode: 'reel', preset: 'faceless', ratios, lang: 'en', inputs: [] });
  const n = await saveVersion(p.id, { plan: { ...fixture, ratios }, by: 'claude', parent: null });
  return { p, n };
}

describe('render job', () => {
  it('render job runs ratios concurrently and emits per-ratio progress', async () => {
    const { p, n } = await setup(['9:16', '4:5', '1:1']);
    const log: { ratio: string; start: number; end: number; profile?: string }[] = [];
    const events: JobEvent[] = [];
    const out = await runRenderJob(p.id, n, 'draft', (e) => events.push({ t: '', ...e } as JobEvent), fakeDeps({ log }));
    expect(Object.keys(out.outputs).sort()).toEqual(['1:1', '4:5', '9:16']);
    for (const f of Object.values(out.outputs)) expect((await stat(f)).isFile()).toBe(true);
    expect(out.outputs['9:16']).toBe(path.join(versionDir(p.id, n), 'render', 'draft-9x16.mp4'));
    const sorted = [...log].sort((a, b) => a.start - b.start);
    expect(sorted[1].start).toBeLessThan(sorted[0].end); // two overlapped
    expect(log.every((l) => l.profile === 'draft')).toBe(true);
    const steps = events.filter((e) => e.type === 'progress').map((e) => (e as { step: string }).step);
    expect(steps).toContain('9:16 render');
    expect(steps).toContain('1:1 done');
  });

  it('final render fails job when a ratio fails QA', async () => {
    const { p, n } = await setup(['9:16', '4:5']);
    const log: { ratio: string; start: number; end: number }[] = [];
    await expect(runRenderJob(p.id, n, 'final', () => undefined, fakeDeps({ log, failRatio: '4:5' }))).rejects.toThrow(/QA failed: 4:5/);
    const qaJson = JSON.parse(await readFile(path.join(versionDir(p.id, n), 'render', 'qa-final-4x5.json'), 'utf8'));
    expect(qaJson.pass).toBe(false);
  });

  it('a failing ratio waits for the other ratios before the job fails', async () => {
    const { p, n } = await setup(['9:16', '4:5']);
    let slowEnded = 0;
    const deps: RenderDeps = {
      concurrency: 2,
      renderLayered: async (_plan, opts) => {
        if (opts.ratio === '9:16') throw new Error('boom');
        await new Promise((r) => setTimeout(r, 300));
        slowEnded = Date.now();
        return { base: 'b' };
      },
      qa: async () => ({ pass: true, checks: [] }),
      thumbnail: async () => undefined,
    };
    await expect(runRenderJob(p.id, n, 'draft', () => undefined, deps)).rejects.toThrow(/boom/);
    expect(slowEnded).toBeGreaterThan(0); // still running when 9:16 failed, finished before the job settled
  });

  it('cancelling a render kills its processes', async () => {
    const { p, n } = await setup(['9:16']);
    const { run } = await import('../../lib/media/run');
    const deps: RenderDeps = {
      concurrency: 1,
      renderLayered: async () => {
        await run(process.execPath, ['-e', 'setTimeout(() => {}, 30000)']);
        return { base: 'b' };
      },
      qa: async () => ({ pass: true, checks: [] }),
      thumbnail: async () => undefined,
    };
    const ac = new AbortController();
    const started = Date.now();
    const job = runRenderJob(p.id, n, 'draft', () => undefined, deps, ac.signal);
    setTimeout(() => ac.abort(), 200);
    await expect(job).rejects.toThrow(/cancelled/);
    expect(Date.now() - started).toBeLessThan(5000);
  });

  it('draft render skips QA', async () => {
    const { p, n } = await setup(['9:16']);
    const log: { ratio: string; start: number; end: number }[] = [];
    await expect(runRenderJob(p.id, n, 'draft', () => undefined, fakeDeps({ log, failRatio: '9:16' }))).resolves.toBeTruthy();
  });
});
