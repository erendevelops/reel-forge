import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { saveSettings } from '../../lib/app/settings';
import { createProject, getProject } from '../../lib/app/workspace/store';
import { projectDir } from '../../lib/app/workspace/paths';
import { JobBusyError, cancelJob, listJobs, resumeJob, startJob, subscribe, type JobEvent } from '../../lib/app/jobs/jobs';

const FAKE = path.join(__dirname, '../fixtures/fake-claude.mjs');
let ws: string;

beforeEach(async () => {
  ws = await mkdtemp(path.join(os.tmpdir(), 'rf-jobs-'));
  process.env.REELFORGE_WORKSPACE = ws;
  await saveSettings({ claudeBinary: `${process.execPath}|${FAKE}` });
});
afterEach(async () => {
  delete process.env.FAKE_CLAUDE_MODE;
  delete process.env.REELFORGE_WORKSPACE;
  await rm(ws, { recursive: true, force: true });
});

const newProject = () => createProject({ name: 'Job test', mode: 'reel', preset: 'faceless', ratios: ['9:16'], lang: 'en', inputs: [] });

const TERMINAL = new Set(['done', 'failed', 'paused-limit', 'cancelled']);
function untilTerminal(projectId: string, jobId: string): Promise<JobEvent[]> {
  return new Promise((resolve) => {
    const seen: JobEvent[] = [];
    const off = subscribe(projectId, jobId, (e) => {
      seen.push(e);
      if (e.type === 'state' && TERMINAL.has(e.state)) {
        queueMicrotask(() => off());
        resolve(seen);
      }
    });
  });
}

describe('jobs', () => {
  it('claude job streams and finishes done', async () => {
    const p = await newProject();
    const { jobId } = await startJob(p.id, { kind: 'claude', prompt: 'hello' });
    const events = await untilTerminal(p.id, jobId);
    expect(events[0]).toMatchObject({ type: 'state', state: 'running' });
    expect(events.some((e) => e.type === 'claude' && e.event.kind === 'tool')).toBe(true);
    expect(events.at(-1)).toMatchObject({ type: 'state', state: 'done' });
    expect((await getProject(p.id)).claudeSession).toBe('sess-1234');
  });

  it('second job while running throws JobBusyError', async () => {
    process.env.FAKE_CLAUDE_MODE = 'hang';
    const p = await newProject();
    const { jobId } = await startJob(p.id, { kind: 'claude', prompt: 'a' });
    await expect(startJob(p.id, { kind: 'claude', prompt: 'b' })).rejects.toBeInstanceOf(JobBusyError);
    await cancelJob(p.id, jobId);
  });

  it('late subscriber receives replayed events', async () => {
    const p = await newProject();
    const { jobId } = await startJob(p.id, { kind: 'claude', prompt: 'hello' });
    await untilTerminal(p.id, jobId);
    const replay = await untilTerminal(p.id, jobId);
    expect(replay[0]).toMatchObject({ type: 'state', state: 'running' });
    expect(replay.at(-1)).toMatchObject({ type: 'state', state: 'done' });
  });

  it('limit ends job paused-limit with reset text', async () => {
    process.env.FAKE_CLAUDE_MODE = 'limit';
    const p = await newProject();
    const { jobId } = await startJob(p.id, { kind: 'claude', prompt: 'hello' });
    const events = await untilTerminal(p.id, jobId);
    expect(events.at(-1)).toMatchObject({ type: 'state', state: 'paused-limit', detail: '2pm (Europe/Istanbul)' });
  });

  it('paused job resumes with --resume', async () => {
    process.env.FAKE_CLAUDE_MODE = 'limit';
    const p = await newProject();
    const first = await startJob(p.id, { kind: 'claude', prompt: 'hello' });
    await untilTerminal(p.id, first.jobId);
    process.env.FAKE_CLAUDE_MODE = 'ok';
    const second = await resumeJob(p.id, first.jobId);
    const events = await untilTerminal(p.id, second.jobId);
    const argv = events.find((e) => e.type === 'claude' && e.event.kind === 'text' && e.event.text.startsWith('argv:'));
    expect(argv && argv.type === 'claude' && argv.event.kind === 'text' ? argv.event.text : '').toContain('--resume sess-1234');
    expect(events.some((e) => e.type === 'claude' && e.event.kind === 'text' && e.event.text === 'prompt: Continue where you stopped.')).toBe(true);
  });

  it('cancel aborts and records cancelled', async () => {
    process.env.FAKE_CLAUDE_MODE = 'hang';
    const p = await newProject();
    const { jobId } = await startJob(p.id, { kind: 'claude', prompt: 'a' });
    const done = untilTerminal(p.id, jobId);
    await cancelJob(p.id, jobId);
    expect((await done).at(-1)).toMatchObject({ type: 'state', state: 'cancelled' });
  });

  it('a running job left on disk by a dead server is marked failed', async () => {
    const p = await newProject();
    const dir = path.join(projectDir(p.id), 'jobs');
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'job-stale.jsonl'), `${JSON.stringify({ t: new Date().toISOString(), type: 'state', state: 'running' })}\n`);
    const jobs = await listJobs(p.id);
    expect(jobs.find((j) => j.jobId === 'job-stale')).toMatchObject({ state: 'failed', detail: 'server restarted' });
  });
});
