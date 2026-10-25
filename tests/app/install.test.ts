import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createProject } from '../../lib/app/workspace/store';
import { projectDir } from '../../lib/app/workspace/paths';

let ws: string;
beforeEach(async () => {
  ws = await mkdtemp(path.join(os.tmpdir(), 'rf-install-'));
  process.env.REELFORGE_WORKSPACE = ws;
});
afterEach(async () => {
  delete process.env.REELFORGE_WORKSPACE;
  await rm(ws, { recursive: true, force: true });
});

const exists = (p: string) => stat(p).then(() => true, () => false);

describe('skill install', () => {
  it('new projects get the preset default selection', async () => {
    const p = await createProject({ name: 'th', mode: 'reel', preset: 'talking-head', ratios: ['9:16'], lang: 'tr', inputs: [] });
    expect(p.selection).toMatchObject({ topicAssets: true, punchIns: false, music: false, captions: 'word-build' });
    expect(p.selection?.cards).toContain('custom-animation');
    const f = await createProject({ name: 'f', mode: 'reel', preset: 'faceless', ratios: ['9:16'], lang: 'tr', inputs: [] });
    expect(f.selection).toMatchObject({ topicAssets: false, punchIns: true, thumbnail: true });
    expect(f.selection?.cards.sort()).toEqual(['logo-pop', 'numbered-list', 'title-card']);
  });

  it('install copies core + preset skill, writes CLAUDE.md and rf shims', async () => {
    const p = await createProject({ name: 'th', mode: 'reel', preset: 'talking-head', ratios: ['9:16'], lang: 'tr', inputs: [] });
    const dir = projectDir(p.id);
    expect(await exists(path.join(dir, '.claude/skills/video-core/SKILL.md'))).toBe(true);
    expect(await exists(path.join(dir, '.claude/skills/reel-talking-head/SKILL.md'))).toBe(true);
    expect(await exists(path.join(dir, '.claude/skills/app-video/SKILL.md'))).toBe(false);
    const md = await readFile(path.join(dir, 'CLAUDE.md'), 'utf8');
    expect(md).toContain('Reply in Türkçe');
    expect(md).toContain('rf save');
    expect(md).toContain('custom-animation');
    const shim = await readFile(path.join(dir, process.platform === 'win32' ? 'rf.cmd' : 'rf'), 'utf8');
    expect(shim).toContain('--tsconfig');
    expect(shim).toContain('scripts');
  });
});
