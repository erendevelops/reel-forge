import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  addPreference,
  createProject,
  getPreferences,
  getProject,
  listProjects,
  listVersions,
  readVersion,
  saveVersion,
  updateProject,
} from '../../lib/app/workspace/store';
import { WorkspaceCorruptError } from '../../lib/app/workspace/files';
import { projectDir } from '../../lib/app/workspace/paths';

const fixture = JSON.parse(await readFile(path.join(__dirname, '../fixtures/plan-reel-v5.json'), 'utf8'));

let ws: string;
let src: string;
beforeEach(async () => {
  ws = await mkdtemp(path.join(os.tmpdir(), 'rf-ws-'));
  src = await mkdtemp(path.join(os.tmpdir(), 'rf-src-'));
  process.env.REELFORGE_WORKSPACE = ws;
});
afterEach(async () => {
  delete process.env.REELFORGE_WORKSPACE;
  await rm(ws, { recursive: true, force: true });
  await rm(src, { recursive: true, force: true });
});

const base = { name: 'Beş Bedava Araç', mode: 'reel' as const, preset: 'faceless' as const, ratios: ['9:16' as const], lang: 'tr' as const, inputs: [] as string[] };

describe('workspace store', () => {
  it('creates and lists projects', async () => {
    const a = await createProject(base);
    const b = await createProject({ ...base, name: 'Second' });
    expect(a.id).toMatch(/^bes-bedava-arac-[a-z0-9]{6}$/);
    expect(a.selection).toMatchObject({ captions: 'word-build' }); // preset default (plan 3)
    expect(a.claudeSession).toBeNull();
    const list = await listProjects();
    expect(list.map((p) => p.id)).toEqual([b.id, a.id]);
    expect((await getProject(a.id)).name).toBe('Beş Bedava Araç');
  });

  it('imports inputs from a unicode path', async () => {
    const folder = path.join(src, 'ğüş İçerik çekimleri');
    await mkdir(path.join(folder, 'alt klasör'), { recursive: true });
    await writeFile(path.join(folder, 'alt klasör', 'çekim 1.txt'), 'merhaba');
    const p = await createProject({ ...base, inputs: [folder] });
    const copied = path.join(projectDir(p.id), 'inputs', 'ğüş İçerik çekimleri', 'alt klasör', 'çekim 1.txt');
    expect(await readFile(copied, 'utf8')).toBe('merhaba');
    expect(await readFile(path.join(folder, 'alt klasör', 'çekim 1.txt'), 'utf8')).toBe('merhaba');
  });

  it('saveVersion numbers sequentially and records origin', async () => {
    const p = await createProject(base);
    expect(await saveVersion(p.id, { plan: fixture, by: 'claude', parent: null, request: 'first cut' })).toBe(1);
    expect(await saveVersion(p.id, { plan: fixture, by: 'user', parent: 1, diff: { moved: 1 } })).toBe(2);
    const versions = await listVersions(p.id);
    expect(versions.map((v) => [v.n, v.by, v.parent])).toEqual([[1, 'claude', null], [2, 'user', 1]]);
    const v2 = await readVersion(p.id, 2);
    expect(v2.plan.duration).toBe(32);
    expect(v2.origin.diff).toEqual({ moved: 1 });
  });

  it('saveVersion rejects an invalid plan with validator errors', async () => {
    const p = await createProject(base);
    const bad = { ...fixture, selection: { ...fixture.selection, cards: [] } };
    await expect(saveVersion(p.id, { plan: bad, by: 'claude', parent: null })).rejects.toThrow(/not selected/);
    expect(await listVersions(p.id)).toEqual([]);
  });

  it('concurrent updates serialise', async () => {
    const p = await createProject(base);
    await Promise.all(Array.from({ length: 20 }, (_, i) => updateProject(p.id, { name: `n${i}` })));
    const final = await getProject(p.id);
    expect(final.name).toMatch(/^n\d+$/);
    expect(Date.parse(final.updatedAt)).toBeGreaterThanOrEqual(Date.parse(p.updatedAt));
  });

  it('corrupt project.json raises WorkspaceCorruptError naming the file', async () => {
    const p = await createProject(base);
    await writeFile(path.join(projectDir(p.id), 'project.json'), '{ nope');
    const err = await getProject(p.id).catch((e) => e);
    expect(err).toBeInstanceOf(WorkspaceCorruptError);
    expect(String(err.message)).toContain('project.json');
  });

  it('preferences persist across projects', async () => {
    await addPreference({ text: 'calm 2–4 s shots', source: 'feedback v2' });
    const prefs = await getPreferences();
    expect(prefs.rules.map((r) => r.text)).toEqual(['calm 2–4 s shots']);
  });
});
