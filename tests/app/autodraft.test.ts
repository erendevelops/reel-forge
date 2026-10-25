import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createProject, listVersions } from '../../lib/app/workspace/store';
import { registerExecutor, startJob, subscribe, type JobEvent, type JobSpec } from '../../lib/app/jobs/jobs';

const FAKE = path.join(__dirname, '../fixtures/fake-claude.mjs');
let ws: string;
const renders: JobSpec[] = [];

beforeEach(async () => {
  ws = await mkdtemp(path.join(os.tmpdir(), 'rf-autodraft-'));
  process.env.REELFORGE_WORKSPACE = ws;
  process.env.REELFORGE_CLAUDE_BINARY = `${process.execPath}|${FAKE}`;
  renders.length = 0;
  registerExecutor('render', async ({ spec }) => {
    renders.push(spec);
    return 'done';
  });
});
afterEach(async () => {
  delete process.env.FAKE_CLAUDE_MODE;
  delete process.env.REELFORGE_WORKSPACE;
  delete process.env.REELFORGE_CLAUDE_BINARY;
  await rm(ws, { recursive: true, force: true });
});

function until(projectId: string, jobId: string): Promise<JobEvent[]> {
  return new Promise((resolve) => {
    const seen: JobEvent[] = [];
    const off = subscribe(projectId, jobId, (e) => {
      seen.push(e);
      if (e.type === 'state' && e.state !== 'running') {
        queueMicrotask(() => off());
        resolve(seen);
      }
    });
  });
}

describe('auto-draft', () => {
  it('auto-draft starts after a claude job that saved a version', async () => {
    process.env.FAKE_CLAUDE_MODE = 'save';
    const p = await createProject({ name: 'ad', mode: 'reel', preset: 'faceless', ratios: ['9:16'], lang: 'en', inputs: [] });
    const { jobId } = await startJob(p.id, { kind: 'claude', prompt: 'plan' });
    await until(p.id, jobId);
    await new Promise((r) => setTimeout(r, 300));
    expect((await listVersions(p.id)).map((x) => x.n)).toEqual([1]);
    expect(renders).toEqual([{ kind: 'render', version: 1, profile: 'draft' }]);
  }, 60000);

  it('no version is saved when the job fails before rf save', async () => {
    process.env.FAKE_CLAUDE_MODE = 'limit';
    const p = await createProject({ name: 'ad2', mode: 'reel', preset: 'faceless', ratios: ['9:16'], lang: 'en', inputs: [] });
    const { jobId } = await startJob(p.id, { kind: 'claude', prompt: 'plan' });
    await until(p.id, jobId);
    await new Promise((r) => setTimeout(r, 300));
    expect(await listVersions(p.id)).toEqual([]);
    expect(renders).toEqual([]);
  });
});
