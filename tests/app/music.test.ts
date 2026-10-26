import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { safeMusicName } from '../../lib/app/music';
import { buildPrompt } from '../../lib/app/claude/prompts';
import { createProject, getProject, updateProject } from '../../lib/app/workspace/store';
import { projectDir } from '../../lib/app/workspace/paths';
import { projectStage } from '../../lib/app/flow';
import { defaultSelection } from '../../lib/app/claude/install';
import { GET, POST, PUT } from '../../app/api/projects/[id]/music/route';

describe('safeMusicName', () => {
  it('keeps Unicode letters, drops paths, turns spaces into dashes', () => {
    expect(safeMusicName('../Şarkı adı.MP3')).toBe('Şarkı-adı.MP3');
    expect(safeMusicName('C:\\Users\\x\\track (final).wav')).toBe('track-final.wav');
  });
  it('refuses anything that is not audio', () => {
    expect(() => safeMusicName('x.exe')).toThrow();
    expect(() => safeMusicName('notes.txt')).toThrow();
  });
});

let ws: string;
beforeEach(async () => {
  ws = await mkdtemp(path.join(os.tmpdir(), 'rf-music-'));
  process.env.REELFORGE_WORKSPACE = ws;
});
afterEach(async () => {
  delete process.env.REELFORGE_WORKSPACE;
  await rm(ws, { recursive: true, force: true });
});

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const candidates = {
  note: 'Pixabay blocked',
  candidates: [
    { title: 'Ambient Minimal', url: 'https://pixabay.com/music/a', license: 'Pixabay Content License', why: 'calm build', contentId: true },
    { title: 'Soft Tech', url: 'https://pixabay.com/music/b', license: 'Pixabay Content License', why: 'light' },
  ],
};
const upload = (id: string, name: string, bytes: number) => {
  const fd = new FormData();
  fd.append('file', new File([new Uint8Array(bytes)], name));
  return PUT(new Request(`http://localhost:3000/api/projects/${id}/music`, { method: 'PUT', body: fd }), ctx(id));
};

describe('music API', () => {
  it('lists candidates, records the pick, takes the upload and moves the project on to planning', async () => {
    const p = await createProject({ name: 'a', mode: 'app', preset: 'app-video', ratios: ['16:9'], lang: 'tr', inputs: [] });
    await updateProject(p.id, { cardsConfirmed: true, selection: { ...defaultSelection('app-video'), music: true } });
    await mkdir(path.join(projectDir(p.id), 'analysis'), { recursive: true });
    await writeFile(path.join(projectDir(p.id), 'analysis', 'music-candidates.json'), JSON.stringify(candidates));
    const list = await (await GET(new Request('http://localhost:3000/x'), ctx(p.id))).json();
    expect(list.candidates).toHaveLength(2);
    expect(list.note).toBe('Pixabay blocked');
    const pick = await POST(new Request('http://localhost:3000/x', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pick: 0 }) }), ctx(p.id));
    expect(pick.status).toBe(200);
    expect((await getProject(p.id)).music).toEqual({ title: 'Ambient Minimal', url: 'https://pixabay.com/music/a', license: 'Pixabay Content License', file: null });
    const up = await upload(p.id, 'Ambient Minimal.mp3', 1024);
    expect(up.status).toBe(200);
    const saved = await getProject(p.id);
    expect(saved.music?.file).toBe('Ambient-Minimal.mp3');
    expect((await readFile(path.join(projectDir(p.id), 'inputs', 'music', 'Ambient-Minimal.mp3'))).length).toBe(1024);
    expect(projectStage(saved, { analysed: true, versions: [], rendered: false })).toBe('plan');
  });

  it('an upload without a pick records it as the user\'s own track', async () => {
    const p = await createProject({ name: 'a', mode: 'app', preset: 'app-video', ratios: ['16:9'], lang: 'tr', inputs: [] });
    await upload(p.id, 'benim.wav', 10);
    expect((await getProject(p.id)).music).toEqual({ title: 'benim.wav', url: null, license: 'user upload', file: 'benim.wav' });
  });

  it('refuses non-audio and files over 50 MB', async () => {
    const p = await createProject({ name: 'a', mode: 'app', preset: 'app-video', ratios: ['16:9'], lang: 'tr', inputs: [] });
    expect((await upload(p.id, 'notes.txt', 10)).status).toBe(400);
    expect((await upload(p.id, 'big.mp3', 51 * 1024 * 1024)).status).toBe(413);
  });

  it('the music stage asks Claude for different tracks', () => {
    const project = { id: 'p', name: 'P', mode: 'app' as const, preset: 'app-video' as const, ratios: ['16:9' as const], lang: 'tr' as const, selection: defaultSelection('app-video'), claudeSession: null, cardsConfirmed: true, transcriptChecked: false, music: null, references: [], createdAt: '', updatedAt: '' };
    const prompt = buildPrompt('music', { project, preferences: { rules: [] }, versions: [] });
    expect(prompt).toContain('analysis/music-candidates.json');
    expect(prompt).toMatch(/different/);
  });
});
