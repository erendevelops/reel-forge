import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { GET, POST } from '../../app/api/projects/route';

let ws: string;
beforeEach(async () => {
  ws = await mkdtemp(path.join(os.tmpdir(), 'rf-api-'));
  process.env.REELFORGE_WORKSPACE = ws;
});
afterEach(async () => {
  delete process.env.REELFORGE_WORKSPACE;
  await rm(ws, { recursive: true, force: true });
});

const post = (body: unknown) =>
  POST(new Request('http://localhost:3000/api/projects', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));

describe('POST /api/projects', () => {
  it('validates and creates', async () => {
    const res = await post({ name: 'Reel', mode: 'reel', preset: 'talking-head', ratios: ['9:16'], lang: 'tr', inputs: [] });
    expect(res.status).toBe(201);
    const p = await res.json();
    expect(p).toMatchObject({ name: 'Reel', preset: 'talking-head', selection: null });
    const list = await (await GET()).json();
    expect(list.map((x: { id: string }) => x.id)).toEqual([p.id]);
  });

  it('rejects missing name with 400', async () => {
    const res = await post({ mode: 'reel', preset: 'faceless', ratios: ['9:16'], lang: 'tr', inputs: [] });
    expect(res.status).toBe(400);
    expect((await res.json()).error.fieldErrors.name).toBeTruthy();
  });

  it('rejects a preset that does not match the mode', async () => {
    const res = await post({ name: 'x', mode: 'reel', preset: 'app-video', ratios: ['16:9'], lang: 'en', inputs: [] });
    expect(res.status).toBe(400);
  });
});
