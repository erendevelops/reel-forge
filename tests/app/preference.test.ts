import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { extractPreference } from '../../lib/app/claude/preference';
import { createProject } from '../../lib/app/workspace/store';
import { startJob, subscribe, type JobEvent } from '../../lib/app/jobs/jobs';

describe('extractPreference', () => {
  it('takes the last PREFERENCE line', () => {
    expect(extractPreference('Done.\nPREFERENCE: Liste daha sağda olsun')).toBe('Liste daha sağda olsun');
    expect(extractPreference('PREFERENCE: a\ntext\nPREFERENCE:  b ')).toBe('b');
    expect(extractPreference('nothing lasting here')).toBeNull();
  });
});

const FAKE = path.join(__dirname, '../fixtures/fake-claude.mjs');
let ws: string;
beforeEach(async () => {
  ws = await mkdtemp(path.join(os.tmpdir(), 'rf-pref-'));
  process.env.REELFORGE_WORKSPACE = ws;
  process.env.REELFORGE_CLAUDE_BINARY = `${process.execPath}|${FAKE}`;
  process.env.FAKE_CLAUDE_MODE = 'preference';
});
afterEach(async () => {
  delete process.env.FAKE_CLAUDE_MODE;
  delete process.env.REELFORGE_WORKSPACE;
  delete process.env.REELFORGE_CLAUDE_BINARY;
  await rm(ws, { recursive: true, force: true });
});

describe('claude jobs', () => {
  it('emit the preference Claude proposes before the job ends', async () => {
    const p = await createProject({ name: 'x', mode: 'reel', preset: 'faceless', ratios: ['9:16'], lang: 'tr', inputs: [] });
    const { jobId } = await startJob(p.id, { kind: 'claude', prompt: 'revise' });
    const events = await new Promise<JobEvent[]>((resolve) => {
      const seen: JobEvent[] = [];
      subscribe(p.id, jobId, (e) => {
        seen.push(e);
        if (e.type === 'state' && e.state !== 'running') resolve(seen);
      });
    });
    const pref = events.find((e) => e.type === 'preference');
    expect(pref).toMatchObject({ type: 'preference', text: 'Liste daha sağda olsun' });
    expect(events.indexOf(pref!)).toBeLessThan(events.length - 1);
  }, 30000);
});
