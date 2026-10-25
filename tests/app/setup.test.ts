import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { checkFaceModel, checkNode, checkClaude } from '../../lib/app/setup/checks';

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'rf-setup-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('setup checks', () => {
  it('node check passes on current runtime', async () => {
    const c = await checkNode('en');
    expect(c).toMatchObject({ id: 'node', ok: true, fix: null });
    expect(c.detail).toContain(process.versions.node);
  });

  it('missing binary yields fix hint in tr and en', async () => {
    const bin = path.join(dir, 'no-claude-here');
    const en = await checkClaude(bin, 'en');
    expect(en).toMatchObject({ id: 'claude', ok: false });
    expect(en.fix).toMatch(/npm install -g @anthropic-ai\/claude-code/);
    expect(en.detail).toMatch(/not installed/);
    const tr = await checkClaude(bin, 'tr');
    expect(tr.detail).toMatch(/kurulu değil/);
  });

  it('face-model check reflects file presence', async () => {
    const model = path.join(dir, 'models', 'blaze_face_short_range.tflite');
    expect((await checkFaceModel(model, 'en')).ok).toBe(false);
    await mkdir(path.dirname(model), { recursive: true });
    await writeFile(model, Buffer.alloc(200_000));
    expect((await checkFaceModel(model, 'en')).ok).toBe(true);
  });

  it('a truncated face model fails the check', async () => {
    const model = path.join(dir, 'tiny.tflite');
    await writeFile(model, 'x');
    expect((await checkFaceModel(model, 'en')).ok).toBe(false);
  });
});
