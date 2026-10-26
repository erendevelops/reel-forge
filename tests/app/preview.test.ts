// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
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
    expect(a.url).toBe(`/api/projects/${p.id}/preview/9x16/index.html?k=${a.key}`);
    const html = await readFile(path.join(projectDir(p.id), '.preview', '9x16', 'index.html'), 'utf8');
    expect(html).toContain('<script src="assets/player.js"></script>');
    expect(await readFile(path.join(projectDir(p.id), '.preview', '9x16', 'assets', 'player.js'), 'utf8')).toBe(PLAYER_JS);
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
