// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildPreview } from '../../lib/preview/build';
import { PLAYER_JS } from '../../lib/preview/player-script';
import { createProject } from '../../lib/app/workspace/store';
import { projectDir } from '../../lib/app/workspace/paths';
import { defaultSelection } from '../../lib/app/claude/install';
import type { Plan } from '../../lib/plan';

let ws: string;
beforeEach(async () => {
  ws = await mkdtemp(path.join(os.tmpdir(), 'rf-preview-'));
  process.env.REELFORGE_WORKSPACE = ws;
});
afterEach(async () => {
  delete process.env.REELFORGE_WORKSPACE;
  await rm(ws, { recursive: true, force: true });
});

const plan = (): Plan => ({
  version: 1, lang: 'tr', mode: 'reel', fps: 30, duration: 3, ratios: ['9:16'],
  selection: { ...defaultSelection('talking-head'), cards: ['stamp'], layouts: ['full-face'] },
  scenes: [{ id: 'a', start: 0, end: 3, say: '', why: 'w', layout: 'full-face', shots: [], cards: [{ type: 'stamp', start: 0.5, end: 2.5, params: { text: 'KALKTI' } }] }],
  captions: { style: 'word-build', groups: [] },
  sfx: [],
});

describe('buildPreview', () => {
  it('compiles the plan with the player script and returns a stable key', async () => {
    const p = await createProject({ name: 'th', mode: 'reel', preset: 'talking-head', ratios: ['9:16'], lang: 'tr', inputs: [] });
    const a = await buildPreview(p.id, plan(), '9:16');
    const b = await buildPreview(p.id, plan(), '9:16');
    expect(a.key).toBe(b.key);
    expect(a.url).toBe(`/api/projects/${p.id}/preview/9x16-${a.key}/index.html`);
    const html = await readFile(path.join(projectDir(p.id), '.preview', `9x16-${a.key}`, 'index.html'), 'utf8');
    expect(html).toContain('<script src="assets/player.js"></script>');
    expect(await readFile(path.join(projectDir(p.id), '.preview', `9x16-${a.key}`, 'assets', 'player.js'), 'utf8')).toBe(PLAYER_JS);
  });

  it('builds different plans into different folders, so a slow build never overwrites a newer one', async () => {
    const p = await createProject({ name: 'th', mode: 'reel', preset: 'talking-head', ratios: ['9:16'], lang: 'tr', inputs: [] });
    const other = plan();
    other.scenes[0].cards[0].params = { text: 'YENİ' };
    const [a, b] = await Promise.all([buildPreview(p.id, plan(), '9:16'), buildPreview(p.id, other, '9:16')]);
    expect(a.url).not.toBe(b.url);
    const dirOf = (u: string) => u.split('/preview/')[1].split('/index.html')[0];
    expect(await readFile(path.join(projectDir(p.id), '.preview', dirOf(a.url), 'index.html'), 'utf8')).toContain('KALKTI');
    expect(await readFile(path.join(projectDir(p.id), '.preview', dirOf(b.url), 'index.html'), 'utf8')).toContain('YENİ');
  });

  it('a new build reuses the media files of the previous build instead of copying them again', async () => {
    const p = await createProject({ name: 'th', mode: 'reel', preset: 'talking-head', ratios: ['9:16'], lang: 'tr', inputs: [] });
    await mkdir(path.join(projectDir(p.id), 'inputs', 'work'), { recursive: true });
    await writeFile(path.join(projectDir(p.id), 'inputs', 'work', 'take.mp4'), Buffer.alloc(2048));
    const withShot = (text: string): Plan => {
      const pl = plan();
      pl.scenes[0].shots = [{ src: 'work/take.mp4', from: 0, to: 3, at: 0 }];
      pl.scenes[0].cards[0].params = { text };
      return pl;
    };
    const a = await buildPreview(p.id, withShot('A'), '9:16');
    const b = await buildPreview(p.id, withShot('B'), '9:16');
    const file = (u: string) => path.join(projectDir(p.id), '.preview', u.split('/preview/')[1].split('/index.html')[0], 'assets', 'work', 'take.mp4');
    expect((await stat(file(b.url))).ino).toBe((await stat(file(a.url))).ino);
  });

  it('serves preview pages with a sandbox CSP, so even a page opened in a tab has no app origin', async () => {
    const p = await createProject({ name: 'th', mode: 'reel', preset: 'talking-head', ratios: ['9:16'], lang: 'tr', inputs: [] });
    const { url } = await buildPreview(p.id, plan(), '9:16');
    const { GET } = await import('../../app/api/projects/[id]/preview/[...path]/route');
    const parts = url.split('/preview/')[1].split('?')[0].split('/');
    const res = await GET(new Request(`http://localhost${url}`), { params: Promise.resolve({ id: p.id, path: parts }) });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-security-policy')).toContain('sandbox allow-scripts');
  });

  it('throws the validation errors for a plan the selection does not allow', async () => {
    const p = await createProject({ name: 'th', mode: 'reel', preset: 'talking-head', ratios: ['9:16'], lang: 'tr', inputs: [] });
    const bad = plan();
    bad.scenes[0].cards[0] = { type: 'title-card', start: 0.5, end: 2.5, params: { n: 1, name: 'x' } };
    await expect(buildPreview(p.id, bad, '9:16')).rejects.toThrow(/title-card not selected/);
  });
});

describe('PLAYER_JS', () => {
  it('seeks the timeline and syncs media clips and element clips to the time', () => {
    document.body.innerHTML =
      '<video class="clip" id="v" data-start="2" data-duration="3" data-media-start="1"></video>' +
      '<div class="clip" id="c" data-start="0" data-duration="1"></div>';
    const seek = vi.fn();
    (window as unknown as { __timelines: unknown }).__timelines = { main: { seek, pause: vi.fn() } };
    const posted: unknown[] = [];
    vi.spyOn(window.parent, 'postMessage').mockImplementation((m) => void posted.push(m));
    new Function(PLAYER_JS)();
    window.dispatchEvent(new MessageEvent('message', { data: { rf: 'seek', t: 3 } }));
    const v = document.getElementById('v') as HTMLVideoElement;
    expect(seek).toHaveBeenCalledWith(3, false);
    expect(v.currentTime).toBe(2);
    expect(v.style.visibility).toBe('visible');
    expect((document.getElementById('c') as HTMLElement).style.visibility).toBe('hidden');
    window.dispatchEvent(new MessageEvent('message', { data: { rf: 'seek', t: 6 } }));
    expect(v.style.visibility).toBe('hidden');
    expect(posted).toContainEqual({ rf: 'time', t: 6 });
  });
});
