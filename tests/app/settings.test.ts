import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { getSettings, saveSettings } from '../../lib/app/settings';

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'rf-settings-'));
  process.env.REELFORGE_WORKSPACE = dir;
});
afterEach(async () => {
  delete process.env.REELFORGE_WORKSPACE;
  await rm(dir, { recursive: true, force: true });
});

describe('settings', () => {
  it('defaults to Turkish and the claude binary on PATH', async () => {
    expect(await getSettings()).toEqual({ language: 'tr', claudeBinary: 'claude' });
  });

  it('saveSettings merges and persists', async () => {
    await saveSettings({ language: 'en' });
    expect(await getSettings()).toEqual({ language: 'en', claudeBinary: 'claude' });
  });
});
