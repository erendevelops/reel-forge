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

it('picks the newest cover for the project list and deletes a project with its files', async () => {
  const { deleteProject, projectThumb } = await import('../../lib/app/workspace/store');
  const { mkdir: md, access } = await import('node:fs/promises');
  const p = await createProject({ name: 'Thumbs', mode: 'reel', preset: 'faceless', ratios: ['9:16'], lang: 'tr', inputs: [] });
  expect(await projectThumb(p.id)).toBeNull();
  for (const v of ['v1', 'v2']) await md(path.join(projectDir(p.id), 'versions', v, 'render'), { recursive: true });
  await writeFile(path.join(projectDir(p.id), 'versions', 'v1', 'render', 'thumbnail-9x16.jpg'), 'x');
  expect(await projectThumb(p.id)).toBe('versions/v1/render/thumbnail-9x16.jpg');
  await writeFile(path.join(projectDir(p.id), 'versions', 'v2', 'render', 'thumbnail-9x16.jpg'), 'x');
  expect(await projectThumb(p.id)).toBe('versions/v2/render/thumbnail-9x16.jpg');
  await deleteProject(p.id);
  await expect(access(projectDir(p.id))).rejects.toThrow();
  await expect(deleteProject('nope-000000')).rejects.toThrow();
});
