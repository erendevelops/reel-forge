import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { TranscriptEditError, applyWordEdits, lines } from '../../lib/app/transcript';
import { createProject, getProject } from '../../lib/app/workspace/store';
import { projectDir } from '../../lib/app/workspace/paths';
import { GET, PUT } from '../../app/api/projects/[id]/transcript/route';

const t = {
  language: 'tr',
  words: [
    { w: 'Para', start: 0, end: 0.3 },
    { w: 'var.', start: 0.3, end: 0.6 },
    { w: 'Ben', start: 0.7, end: 0.9 },
    { w: 'fokus', start: 0.9, end: 1.2 },
    { w: 'kurdum', start: 1.9, end: 2.3 },
  ],
};

describe('transcript edits', () => {
  it('changes only the words, never the timings, and allows two words in one slot', () => {
    const out = applyWordEdits(t, ['Para', 'var.', 'Ben', "Fooocus'u", 'hemen kurdum']);
    expect(out.words.map((x) => x.w)).toEqual(['Para', 'var.', 'Ben', "Fooocus'u", 'hemen kurdum']);
    expect(out.words.map((x) => [x.start, x.end])).toEqual(t.words.map((x) => [x.start, x.end]));
  });

  it('refuses a different word count or an empty word', () => {
    expect(() => applyWordEdits(t, ['Para'])).toThrow(TranscriptEditError);
    expect(() => applyWordEdits(t, ['Para', 'var.', '  ', 'fokus', 'kurdum'])).toThrow(TranscriptEditError);
  });

  it('splits display lines after sentence ends and at pauses', () => {
    expect(lines(t)).toEqual([[0, 1], [2, 3], [4]]);
  });
});

let ws: string;
beforeEach(async () => {
  ws = await mkdtemp(path.join(os.tmpdir(), 'rf-tr-'));
  process.env.REELFORGE_WORKSPACE = ws;
});
afterEach(async () => {
  delete process.env.REELFORGE_WORKSPACE;
  await rm(ws, { recursive: true, force: true });
});

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const put = (id: string, body: unknown) =>
  PUT(new Request(`http://localhost:3000/api/projects/${id}/transcript`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), ctx(id));

describe('transcript API', () => {
  it('404s without a transcript, then round-trips an edit and marks it checked', async () => {
    const p = await createProject({ name: 'f', mode: 'reel', preset: 'faceless', ratios: ['9:16'], lang: 'tr', inputs: [] });
    expect((await GET(new Request('http://localhost:3000/x'), ctx(p.id))).status).toBe(404);
    await mkdir(path.join(projectDir(p.id), 'analysis'), { recursive: true });
    await writeFile(path.join(projectDir(p.id), 'analysis', 'transcript.json'), JSON.stringify(t));
    const got = await (await GET(new Request('http://localhost:3000/x'), ctx(p.id))).json();
    expect(got.file).toBe('analysis/transcript.json');
    const res = await put(p.id, { words: ['Para', 'var.', 'Ben', 'Fooocus', 'kurdum'] });
    expect(res.status).toBe(200);
    const saved = JSON.parse(await readFile(path.join(projectDir(p.id), 'analysis', 'transcript.json'), 'utf8'));
    expect(saved.words[3]).toEqual({ w: 'Fooocus', start: 0.9, end: 1.2 });
    expect((await getProject(p.id)).transcriptChecked).toBe(true);
    expect((await put(p.id, { words: ['x'] })).status).toBe(400);
  });
});

describe('syncCaptions', () => {
  const t = { language: 'tr', words: [{ w: 'herkes', start: 1.12, end: 1.52 }, { w: 'Claude', start: 1.52, end: 1.86 }, { w: 'editlediğini', start: 2.78, end: 3.36 }, { w: 'hemen kurdum', start: 4, end: 4.6 }] };
  const plan = (words: [string, number][]) => ({ captions: { groups: [{ words }] } });
  it('puts the corrected words into captions, keeping punctuation and splits', async () => {
    const { syncCaptions } = await import('../../lib/app/transcript');
    const r = syncCaptions(plan([['herkes', 1.12], ['Cloud', 1.52], ['elitlediğini,', 2.78], ['hemen', 4], ['kurdum', 4.3]]), t);
    expect(r.plan.captions.groups[0].words.map((w) => w[0])).toEqual(['herkes', 'Claude', 'editlediğini,', 'hemen', 'kurdum']);
    expect(r.fixed).toBe(2);
  });
  it('leaves words with no transcript word at that time alone', async () => {
    const { syncCaptions } = await import('../../lib/app/transcript');
    expect(syncCaptions(plan([['Abone', 9]]), t).fixed).toBe(0);
  });
});
