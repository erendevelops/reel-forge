import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createProject, getProject } from '../../lib/app/workspace/store';
import { defaultSelection } from '../../lib/app/claude/install';

const started: { prompt: string }[] = [];
let busy = false;
vi.mock('../../lib/app/jobs/jobs', async (orig) => {
  const real = await orig<typeof import('../../lib/app/jobs/jobs')>();
  return {
    ...real,
    startJob: vi.fn(async (id: string, spec: { prompt: string }) => {
      if (busy) throw new real.JobBusyError(id);
      started.push(spec);
      return { jobId: 'job-x' };
    }),
  };
});
const { POST } = await import('../../app/api/projects/[id]/confirm/route');

let ws: string;
beforeEach(async () => {
  ws = await mkdtemp(path.join(os.tmpdir(), 'rf-confirm-'));
  process.env.REELFORGE_WORKSPACE = ws;
  started.length = 0;
  busy = false;
});
afterEach(async () => {
  delete process.env.REELFORGE_WORKSPACE;
  await rm(ws, { recursive: true, force: true });
});

const call = (id: string, body: unknown) =>
  POST(new Request(`http://localhost:3000/api/projects/${id}/confirm`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), { params: Promise.resolve({ id }) });
const make = () => createProject({ name: 'th', mode: 'reel', preset: 'talking-head', ratios: ['9:16'], lang: 'tr', inputs: [] });

describe('POST /api/projects/[id]/confirm', () => {
  it('saves selection, ratios and references, then starts the analyse job with the reference URLs', async () => {
    const p = await make();
    const selection = { ...defaultSelection('talking-head'), cards: ['stamp' as const] };
    const res = await call(p.id, { selection, ratios: ['9:16', '1:1'], references: ['https://www.instagram.com/reels/Dej4G75uvrI/'] });
    expect(res.status).toBe(201);
    const saved = await getProject(p.id);
    expect(saved).toMatchObject({ cardsConfirmed: true, ratios: ['9:16', '1:1'], references: ['https://www.instagram.com/reels/Dej4G75uvrI/'] });
    expect(saved.selection?.cards).toEqual(['stamp']);
    expect(started[0].prompt).toContain('Stage: analyse');
    expect(started[0].prompt).toContain('https://www.instagram.com/reels/Dej4G75uvrI/');
  });

  it('answers 409 while a job runs: keeps the selection but stays on the cards (no analysis started)', async () => {
    const p = await make();
    busy = true;
    const selection = { ...defaultSelection('talking-head'), cards: ['stamp' as const] };
    const res = await call(p.id, { selection, ratios: ['9:16'], references: [] });
    expect(res.status).toBe(409);
    const saved = await getProject(p.id);
    expect(saved.cardsConfirmed).toBe(false);
    expect(saved.selection?.cards).toEqual(['stamp']);
  });

  it('refuses non-https references and an empty ratio list', async () => {
    const p = await make();
    const sel = defaultSelection('talking-head');
    expect((await call(p.id, { selection: sel, ratios: ['9:16'], references: ['javascript:alert(1)'] })).status).toBe(400);
    expect((await call(p.id, { selection: sel, ratios: ['9:16'], references: ['http://x.com/a'] })).status).toBe(400);
    expect((await call(p.id, { selection: sel, ratios: [], references: [] })).status).toBe(400);
  });
});
