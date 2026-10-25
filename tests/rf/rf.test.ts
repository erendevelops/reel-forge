import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createProject, listVersions, updateProject } from '../../lib/app/workspace/store';
import { projectDir } from '../../lib/app/workspace/paths';
import { makeClip } from '../helpers/media';

const ROOT = path.join(__dirname, '../..');
const TSX = path.join(ROOT, 'node_modules/tsx/dist/cli.mjs');
const RF = path.join(ROOT, 'scripts/rf.ts');

let ws: string;
beforeEach(async () => {
  ws = await mkdtemp(path.join(os.tmpdir(), 'rf-cli-'));
  process.env.REELFORGE_WORKSPACE = ws;
});
afterEach(async () => {
  delete process.env.REELFORGE_WORKSPACE;
  await rm(ws, { recursive: true, force: true });
});

function rf(projectId: string, args: string[]): Promise<{ code: number; json: any }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [TSX, '--tsconfig', path.join(ROOT, 'tsconfig.json'), RF, ...args], {
      cwd: projectDir(projectId),
      env: { ...process.env, REELFORGE_WORKSPACE: ws, REELFORGE_PROJECT: projectId, REELFORGE_ROOT: ROOT },
    });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.on('close', (code) => {
      let json: any = null;
      try {
        json = JSON.parse(out.trim().split('\n').at(-1) ?? '');
      } catch {
        json = { raw: out };
      }
      resolve({ code: code ?? -1, json });
    });
  });
}

const project = (preset: 'faceless' | 'talking-head' = 'faceless') =>
  createProject({ name: 'rf test', mode: 'reel', preset, ratios: ['9:16'], lang: 'en', inputs: [] });

describe('rf', () => {
  it('project prints project, preferences and versions', async () => {
    const p = await project();
    const r = await rf(p.id, ['project']);
    expect(r.code).toBe(0);
    expect(r.json.project.id).toBe(p.id);
    expect(r.json.preferences).toEqual({ rules: [] });
    expect(r.json.versions).toEqual([]);
  });

  it('rf probe handles a unicode path', async () => {
    const p = await project();
    const dir = path.join(projectDir(p.id), 'inputs', 'çekim İ 1');
    await mkdir(dir, { recursive: true });
    const clip = await makeClip(dir, { w: 320, h: 240, fps: 30, seconds: 1 });
    const r = await rf(p.id, ['probe', path.relative(projectDir(p.id), clip)]);
    expect(r.code).toBe(0);
    expect(r.json).toMatchObject({ width: 320, height: 240, fps: 30 });
  });

  it('rf refuses paths outside the project', async () => {
    const p = await project();
    const r = await rf(p.id, ['probe', '../../x.mp4']);
    expect(r.code).toBe(1);
    expect(r.json.error).toMatch(/path outside project/);
  });

  it('save stores a valid plan as a new version', async () => {
    const p = await project();
    await copyFile(path.join(ROOT, 'tests/fixtures/plan-reel-v5.json'), path.join(projectDir(p.id), 'plan.json'));
    const r = await rf(p.id, ['save', 'plan.json', '--request', 'first cut']);
    expect(r).toMatchObject({ code: 0, json: { version: 1 } });
    expect((await listVersions(p.id))[0]).toMatchObject({ n: 1, by: 'claude', request: 'first cut' });
  });

  it('save rejects unselected card', async () => {
    const p = await project();
    // The user's project selection no longer ticks title-card; the v5 plan still uses it.
    await updateProject(p.id, { selection: { ...p.selection!, cards: p.selection!.cards.filter((c) => c !== 'title-card') } });
    await copyFile(path.join(ROOT, 'tests/fixtures/plan-reel-v5.json'), path.join(projectDir(p.id), 'plan.json'));
    const r = await rf(p.id, ['save', 'plan.json']);
    expect(r.code).toBe(1);
    expect(r.json.error).toMatch(/not selected/);
    expect(await listVersions(p.id)).toEqual([]);
  });

  it('save rejects motion gaps for talking head', async () => {
    const p = await project('talking-head');
    await copyFile(path.join(ROOT, 'spikes/talking-head/plan.json'), path.join(projectDir(p.id), 'plan.json'));
    const r = await rf(p.id, ['save', 'plan.json']);
    expect(r.code).toBe(1);
    expect(r.json.error).toMatch(/static for more than 3 s/);
    expect(await listVersions(p.id)).toEqual([]);
  });

  it("save enforces the project selection, not the plan's own copy", async () => {
    const p = await project();
    const plan = JSON.parse(await readFile(path.join(ROOT, 'tests/fixtures/plan-reel-v5.json'), 'utf8'));
    // Claude adds an unticked card AND writes it into the plan's own selection.
    plan.selection.cards.push('stamp');
    plan.scenes[0].cards.push({ type: 'stamp', start: 0.5, end: 1.5, params: { text: 'FREE' } });
    await writeFile(path.join(projectDir(p.id), 'plan.json'), JSON.stringify(plan));
    const r = await rf(p.id, ['save', 'plan.json']);
    expect(r.code).toBe(1);
    expect(r.json.error).toMatch(/stamp not selected/);
    expect(await listVersions(p.id)).toEqual([]);
  });

  it('project returns the latest plan so revisions start from it', async () => {
    const p = await project();
    await copyFile(path.join(ROOT, 'tests/fixtures/plan-reel-v5.json'), path.join(projectDir(p.id), 'plan.json'));
    await rf(p.id, ['save', 'plan.json']);
    const r = await rf(p.id, ['project']);
    expect(r.json.latest).toMatchObject({ n: 1, plan: { duration: 32 } });
  });

  it('logo resolves ChatGPT and writes the svg', async () => {
    const p = await project();
    const r = await rf(p.id, ['logo', 'ChatGPT']);
    expect(r.json).toMatchObject({ found: true, slug: 'openai' });
    expect((await stat(path.join(projectDir(p.id), r.json.file))).isFile()).toBe(true);
  });

  it('logo not found is explicit', async () => {
    const p = await project();
    expect((await rf(p.id, ['logo', 'Zzqx Tool'])).json).toEqual({ found: false });
  });

  it('beats finds 120 BPM on a click track', async () => {
    const p = await project();
    const { run } = await import('../../lib/media/run');
    // 120 BPM: a 30 ms click every 0.5 s for 12 s.
    await run('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', "aevalsrc='if(lt(mod(t,0.5),0.03),sin(2*PI*1000*t),0)':s=44100:d=12", path.join(projectDir(p.id), 'click.wav')]);
    const r = await rf(p.id, ['beats', 'click.wav']);
    expect(r.code).toBe(0);
    expect(r.json.bpm).toBeGreaterThan(115);
    expect(r.json.bpm).toBeLessThan(125);
    const gaps = r.json.beats.slice(1).map((b: number, i: number) => b - r.json.beats[i]);
    expect(gaps.every((g: number) => Math.abs(g - 0.5) < 0.03)).toBe(true);
  }, 60000);

  it('trimtake renders the kept segments and re-times the transcript', async () => {
    const p = await project('talking-head');
    const dir = projectDir(p.id);
    const clip = await makeClip(dir, { w: 640, h: 360, fps: 30, seconds: 4, audio: true });
    const t = { language: 'en', words: [{ w: 'one', start: 0.2, end: 0.6 }, { w: 'two', start: 0.8, end: 1.1 }, { w: 'three', start: 3.0, end: 3.5 }] };
    await writeFile(path.join(dir, 't.json'), JSON.stringify(t));
    await writeFile(path.join(dir, 'trims.json'), JSON.stringify({ segments: [{ from: 0.1, to: 1.2 }, { from: 2.9, to: 3.6 }] }));
    const r = await rf(p.id, ['trimtake', path.relative(dir, clip), 'trims.json', 'take.mp4', '--transcript', 't.json']);
    expect(r.code).toBe(0);
    expect(r.json.duration).toBeCloseTo(1.8, 1);
    const re = JSON.parse(await readFile(path.join(dir, r.json.transcript), 'utf8'));
    expect(re.words.map((w: { w: string }) => w.w)).toEqual(['one', 'two', 'three']);
    expect(re.words[2].start).toBeCloseTo(1.2, 1); // 3.0 − 2.9 + 1.1 (first segment's length)
  }, 60000);

  it('unknown command exits 1 with the command list', async () => {
    const p = await project();
    const r = await rf(p.id, ['nope']);
    expect(r.code).toBe(1);
    expect(r.json.error).toMatch(/unknown command nope.*save/s);
  });
});
