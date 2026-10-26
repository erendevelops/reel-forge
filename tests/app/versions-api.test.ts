import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createProject, readVersion, saveVersion, updateProject } from '../../lib/app/workspace/store';
import { versionDir } from '../../lib/app/workspace/paths';
import { defaultSelection } from '../../lib/app/claude/install';
import { POST } from '../../app/api/projects/[id]/versions/route';
import { GET as getVersion } from '../../app/api/projects/[id]/versions/[n]/route';
import { GET as getFile } from '../../app/api/projects/[id]/files/[...path]/route';
import type { Plan } from '../../lib/plan';

let ws: string;
beforeEach(async () => {
  ws = await mkdtemp(path.join(os.tmpdir(), 'rf-versions-'));
  process.env.REELFORGE_WORKSPACE = ws;
});
afterEach(async () => {
  delete process.env.REELFORGE_WORKSPACE;
  await rm(ws, { recursive: true, force: true });
});

const selection = { ...defaultSelection('talking-head'), cards: ['stamp' as const], layouts: ['full-face' as const] };
const plan = (): Plan => ({
  version: 1, lang: 'tr', mode: 'reel', fps: 30, duration: 3, ratios: ['9:16'], selection,
  scenes: [{ id: 'a', start: 0, end: 3, say: 'kural kalktı', why: 'w', layout: 'full-face', shots: [], cards: [{ type: 'stamp', start: 0.5, end: 2.5, params: { text: 'KALKTI' } }] }],
  captions: { style: 'word-build', groups: [] },
  sfx: [],
});
async function setup() {
  const p = await createProject({ name: 'th', mode: 'reel', preset: 'talking-head', ratios: ['9:16'], lang: 'tr', inputs: [] });
  await updateProject(p.id, { selection });
  await saveVersion(p.id, { plan: plan(), by: 'claude', parent: null, request: 'first cut' });
  return p.id;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ctx = (id: string, extra: object = {}): any => ({ params: Promise.resolve({ id, ...extra }) });
const post = (id: string, body: unknown) => POST(new Request('http://localhost/x', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), ctx(id));

describe('user versions', () => {
  it('saves edits on v1 as v2 by the user, with the diff', async () => {
    const id = await setup();
    const res = await post(id, { parent: 1, edits: [{ op: 'card-param', scene: 'a', card: 0, key: 'text', value: 'GONE' }] });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ n: 2, parent: 1, branched: false });
    const v2 = await readVersion(id, 2);
    expect(v2.origin).toMatchObject({ by: 'user', parent: 1, request: null });
    expect(v2.origin.diff).toEqual([{ path: 'scenes[0].cards[0].params.text', from: 'KALKTI', to: 'GONE' }]);
  });

  it('branches when the parent is not the latest version', async () => {
    const id = await setup();
    await saveVersion(id, { plan: plan(), by: 'claude', parent: 1, request: 'v2' });
    const res = await post(id, { parent: 1, edits: [{ op: 'sfx', index: 0 }] });
    expect(res.status).toBe(400); // no sound cue 0
    const ok = await post(id, { parent: 1, edits: [{ op: 'card-time', scene: 'a', card: 0, start: 0.4, end: 2.5 }] });
    expect(await ok.json()).toEqual({ n: 3, parent: 1, branched: true });
  });

  it('refuses an edited plan the project selection does not allow', async () => {
    const id = await setup();
    await updateProject(id, { selection: { ...selection, cards: [] } });
    const res = await post(id, { parent: 1, edits: [] });
    expect(res.status).toBe(400);
    expect(JSON.stringify(await res.json())).toMatch(/not selected/);
  });

  it('lists the render files of a version and serves them, but nothing outside versions/ and inputs/', async () => {
    const id = await setup();
    const dir = path.join(versionDir(id, 1), 'render');
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'final-9x16.mp4'), 'mp4');
    await writeFile(path.join(dir, 'qa-final-9x16.json'), JSON.stringify({ ok: true }));
    const v = await (await getVersion(new Request('http://localhost/x'), ctx(id, { n: '1' }))).json();
    expect(v.renders).toEqual([{ ratio: '9:16', profile: 'final', url: `/api/projects/${id}/files/versions/v1/render/final-9x16.mp4` }]);
    expect(v.qa['final-9x16']).toEqual({ ok: true });
    const file = await getFile(new Request('http://localhost/x'), ctx(id, { path: ['versions', 'v1', 'render', 'final-9x16.mp4'] }));
    expect(file.status).toBe(200);
    expect((await getFile(new Request('http://localhost/x'), ctx(id, { path: ['project.json'] }))).status).toBe(404);
    expect((await getFile(new Request('http://localhost/x'), ctx(id, { path: ['analysis', 'x.json'] }))).status).toBe(404);
    expect((await getFile(new Request('http://localhost/x'), ctx(id, { path: ['versions', '..', 'project.json'] }))).status).toBe(404);
  });
});
