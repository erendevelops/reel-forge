import { afterEach, beforeEach, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createProject, getProject, updateProject } from '../../lib/app/workspace/store';
import { projectDir } from '../../lib/app/workspace/paths';

let ws: string;
beforeEach(async () => {
  ws = await mkdtemp(path.join(os.tmpdir(), 'rf-backup-'));
  process.env.REELFORGE_WORKSPACE = ws;
});
afterEach(async () => {
  delete process.env.REELFORGE_WORKSPACE;
  await rm(ws, { recursive: true, force: true });
});

it('restores a project.json broken from outside from its backup', async () => {
  const p = await createProject({ name: 'Demo', mode: 'reel', preset: 'faceless', ratios: ['9:16'], lang: 'tr', inputs: [] });
  await updateProject(p.id, { cardsConfirmed: true });
  const file = path.join(projectDir(p.id), 'project.json');
  await writeFile(file, '{"error":"Unexpected end of JSON input"}');
  expect((await getProject(p.id)).cardsConfirmed).toBe(true);
  expect(JSON.parse(await readFile(file, 'utf8')).id).toBe(p.id);
});
