import { randomUUID } from 'node:crypto';
import { appendFile, mkdir, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { DEFAULT_ALLOWED_TOOLS, runClaude } from '@/lib/app/claude/run';
import type { ClaudeEvent } from '@/lib/app/claude/events';
import { claudeCommand } from '@/lib/app/settings';
import { projectDir } from '@/lib/app/workspace/paths';
import { getProject, listVersions, updateProject } from '@/lib/app/workspace/store';
import { workspaceDir } from '@/lib/app/workspace/paths';
import { REPO_ROOT } from '@/lib/root';

export type JobKind = 'claude' | 'render';
export type JobState = 'running' | 'done' | 'failed' | 'paused-limit' | 'cancelled';
export type JobEvent =
  | { t: string; type: 'claude'; event: ClaudeEvent }
  | { t: string; type: 'progress'; step: string; pct?: number }
  | { t: string; type: 'state'; state: JobState; detail?: string };

export type ClaudeJobSpec = { kind: 'claude'; prompt: string; resumeSession?: string | null };
export type JobSpec = ClaudeJobSpec | ExtraJobSpec;
/** Other job kinds register an executor; Task 6 adds `render`. */
export type ExtraJobSpec = { kind: Exclude<JobKind, 'claude'>; [k: string]: unknown };

export class JobBusyError extends Error {
  constructor(projectId: string) {
    super(`a job is already running for ${projectId}`);
    this.name = 'JobBusyError';
  }
}

type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;
export type Emit = (e: DistributiveOmit<JobEvent, 't'>) => void;
/** `next`: a job to start once this one has released the project (e.g. the draft render after a plan). */
export type Executor = (ctx: { projectId: string; spec: JobSpec; emit: Emit; signal: AbortSignal }) => Promise<JobState | { state: JobState; detail?: string; next?: JobSpec }>;

type Live = { projectId: string; jobId: string; events: JobEvent[]; listeners: Set<(e: JobEvent) => void>; abort: AbortController };

const live = new Map<string, Live>(); // key: `${projectId}/${jobId}`
const runningByProject = new Map<string, string>();
const executors = new Map<JobKind, Executor>();

const CLAUDE_TIMEOUT_MS = 60 * 60 * 1000;

export function registerExecutor(kind: JobKind, run: Executor): void {
  executors.set(kind, run);
}

const jobsDir = (projectId: string) => path.join(projectDir(projectId), 'jobs');
const JOB_ID = /^job-[a-z0-9-]+$/;
function jobFile(projectId: string, jobId: string): string {
  if (!JOB_ID.test(jobId)) throw new Error(`invalid job id: ${jobId}`);
  return path.join(jobsDir(projectId), `${jobId}.jsonl`);
}
const isTerminal = (e: JobEvent) => e.type === 'state' && e.state !== 'running';

registerExecutor('claude', async ({ projectId, spec, emit, signal }) => {
  const s = spec as ClaudeJobSpec;
  const project = await getProject(projectId);
  const claudeBinary = await claudeCommand();
  const before = (await listVersions(projectId)).length;
  let error: Extract<ClaudeEvent, { kind: 'error' }> | null = null;
  const res = await runClaude({
    binary: claudeBinary,
    cwd: projectDir(projectId),
    prompt: s.prompt,
    resumeSession: s.resumeSession ?? null,
    allowedTools: DEFAULT_ALLOWED_TOOLS,
    timeoutMs: CLAUDE_TIMEOUT_MS,
    signal,
    // rf (the skills' tool) finds its project and the repo through these.
    env: { REELFORGE_PROJECT: projectId, REELFORGE_WORKSPACE: workspaceDir(), REELFORGE_ROOT: REPO_ROOT },
    onEvent: (event) => {
      if (event.kind === 'error') error = event;
      emit({ type: 'claude', event });
    },
  });
  if (res.sessionId && res.sessionId !== project.claudeSession) await updateProject(projectId, { claudeSession: res.sessionId });
  if (res.ok) {
    const versions = await listVersions(projectId);
    // A plan job that saved a version gets a draft render straight away.
    if (versions.length > before) return { state: 'done', next: { kind: 'render', version: versions.at(-1)!.n, profile: 'draft' } };
    return 'done';
  }
  if (signal.aborted) return 'cancelled';
  const e = error as Extract<ClaudeEvent, { kind: 'error' }> | null;
  if (e?.code === 'limit') return { state: 'paused-limit', detail: e.resetsAt ?? e.message };
  return { state: 'failed', detail: e?.message };
});

export async function startJob(projectId: string, spec: JobSpec): Promise<{ jobId: string }> {
  await getProject(projectId);
  if (runningByProject.has(projectId)) throw new JobBusyError(projectId);
  const run = executors.get(spec.kind);
  if (!run) throw new Error(`no executor for job kind ${spec.kind}`);

  const jobId = `job-${Date.now().toString(36)}-${randomUUID().slice(0, 6)}`;
  const job: Live = { projectId, jobId, events: [], listeners: new Set(), abort: new AbortController() };
  live.set(`${projectId}/${jobId}`, job);
  runningByProject.set(projectId, jobId);
  await mkdir(jobsDir(projectId), { recursive: true });
  const file = jobFile(projectId, jobId); // resolved once: the workspace root must not change mid-job

  // Appends are chained so the JSONL keeps event order.
  let write = Promise.resolve();
  const emit: Emit = (partial) => {
    const e = { t: new Date().toISOString(), ...partial } as JobEvent;
    job.events.push(e);
    // A failed append (disk full, OneDrive lock) loses that line but never wedges the chain for later events.
    write = write.then(() => appendFile(file, `${JSON.stringify(e)}\n`, 'utf8')).catch(() => undefined);
    for (const l of job.listeners) l(e);
  };

  emit({ type: 'state', state: 'running' });
  void (async () => {
    let end: { state: JobState; detail?: string; next?: JobSpec };
    try {
      const out = await run({ projectId, spec, emit, signal: job.abort.signal });
      end = typeof out === 'string' ? { state: out } : out;
    } catch (err) {
      end = { state: job.abort.signal.aborted ? 'cancelled' : 'failed', detail: (err as Error).message };
    }
    if (job.abort.signal.aborted) end = { state: 'cancelled' };
    const { next, ...final } = end;
    try {
      emit({ type: 'state', ...final });
      await write;
    } finally {
      runningByProject.delete(projectId);
      live.delete(`${projectId}/${jobId}`);
    }
    if (next && final.state === 'done') await startJob(projectId, next).catch(() => undefined);
  })();
  return { jobId };
}

async function readEvents(projectId: string, jobId: string): Promise<JobEvent[]> {
  let raw: string;
  try {
    raw = await readFile(jobFile(projectId, jobId), 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  return raw.split('\n').filter(Boolean).flatMap((l) => {
    try {
      return [JSON.parse(l) as JobEvent];
    } catch {
      return [];
    }
  });
}

/** Replays everything so far, then streams live events. Returns an unsubscribe function. */
export function subscribe(projectId: string, jobId: string, onEvent: (e: JobEvent) => void): () => void {
  jobFile(projectId, jobId); // validates the id
  const job = live.get(`${projectId}/${jobId}`);
  if (job) {
    for (const e of job.events) onEvent(e);
    job.listeners.add(onEvent);
    return () => job.listeners.delete(onEvent);
  }
  let active = true;
  void readEvents(projectId, jobId).then((events) => {
    for (const e of events) if (active) onEvent(e);
  });
  return () => {
    active = false;
  };
}

export async function listJobs(projectId: string): Promise<{ jobId: string; state: JobState; detail?: string; startedAt: string }[]> {
  let names: string[];
  try {
    names = await readdir(jobsDir(projectId));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  const jobs = [];
  for (const name of names.filter((n) => n.endsWith('.jsonl'))) {
    const jobId = name.slice(0, -'.jsonl'.length);
    const events = await readEvents(projectId, jobId);
    const states = events.filter((e): e is Extract<JobEvent, { type: 'state' }> => e.type === 'state');
    let last = states.at(-1) ?? { state: 'failed' as JobState, detail: 'empty log', t: '' };
    if (last.state === 'running' && !live.has(`${projectId}/${jobId}`)) {
      // A job still "running" on disk but unknown in memory belonged to a server that died.
      const e: JobEvent = { t: new Date().toISOString(), type: 'state', state: 'failed', detail: 'server restarted' };
      await appendFile(jobFile(projectId, jobId), `${JSON.stringify(e)}\n`, 'utf8');
      last = e;
    }
    jobs.push({ jobId, state: last.state, detail: last.detail, startedAt: events[0]?.t ?? '' });
  }
  return jobs.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export async function resumeJob(projectId: string, jobId: string): Promise<{ jobId: string }> {
  jobFile(projectId, jobId); // validates the id
  const events = await readEvents(projectId, jobId);
  const last = [...events].reverse().find((e) => e.type === 'state');
  if (!last || last.type !== 'state' || last.state !== 'paused-limit') throw new Error(`job ${jobId} is not paused by a usage limit`);
  const { claudeSession } = await getProject(projectId);
  return startJob(projectId, { kind: 'claude', prompt: 'Continue where you stopped.', resumeSession: claudeSession });
}

export async function cancelJob(projectId: string, jobId: string): Promise<void> {
  const job = live.get(`${projectId}/${jobId}`);
  if (!job) return;
  const ended = new Promise<void>((resolve) => job.listeners.add((e) => isTerminal(e) && resolve()));
  job.abort.abort();
  await ended;
}
