import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { isSkipped, safeRelPath } from '../../lib/app/upload';
import { createProject } from '../../lib/app/workspace/store';
import { projectDir } from '../../lib/app/workspace/paths';
import { PUT } from '../../app/api/projects/[id]/inputs/route';

let ws: string;
beforeEach(async () => {
  ws = await mkdtemp(path.join(os.tmpdir(), 'rf-up-'));
  process.env.REELFORGE_WORKSPACE = ws;
});
afterEach(async () => {
  delete process.env.REELFORGE_WORKSPACE;
  await rm(ws, { recursive: true, force: true });
});

const put = (id: string, rel: string, body: string) =>
  PUT(new Request(`http://localhost/api/projects/${id}/inputs?path=${encodeURIComponent(rel)}`, { method: 'PUT', body, duplex: 'half' } as RequestInit), { params: Promise.resolve({ id }) });

describe('imported files', () => {
  it('cleans browser paths and skips dependency folders', () => {
    expect(safeRelPath('../../çekimler/klip 1.mp4')).toBe('çekimler/klip 1.mp4');
    expect(safeRelPath('C:\\x\\a.mp4')).toBe('x/a.mp4');
    expect(safeRelPath('..')).toBeNull();
    expect(isSkipped('prao/node_modules/react/index.js')).toBe(true);
    expect(isSkipped('prao/src/app.tsx')).toBe(false);
  });

  it('streams a file into inputs/ under its folder, and skips node_modules', async () => {
    const p = await createProject({ name: 'x', mode: 'reel', preset: 'faceless', ratios: ['9:16'], lang: 'tr', inputs: [] });
    expect((await put(p.id, 'çekimler/klip 1.mp4', 'video-bytes')).status).toBe(201);
    expect(await readFile(path.join(projectDir(p.id), 'inputs', 'çekimler', 'klip 1.mp4'), 'utf8')).toBe('video-bytes');
    expect((await put(p.id, 'app/node_modules/x.js', 'x')).status).toBe(204);
    await expect(stat(path.join(projectDir(p.id), 'inputs', 'app'))).rejects.toThrow();
    expect((await put(p.id, '../..', 'x')).status).toBe(400);
  });
});
