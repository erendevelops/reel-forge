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

describe('settings security', () => {
  it('rejects a claude binary containing shell metacharacters', async () => {
    for (const bad of ['x & calc', 'claude; rm -rf /', 'claude | evil', '$(evil)', 'claude`x`', 'a\nb']) {
      await expect(saveSettings({ claudeBinary: bad })).rejects.toThrow();
    }
    await expect(saveSettings({ claudeBinary: 'C:/Users/me/AppData/Roaming/npm/claude.cmd' })).resolves.toBeTruthy();
    await expect(saveSettings({ claudeBinary: 'C:\\Program Files\\Claude\\claude.exe' })).resolves.toBeTruthy();
  });

  it('dev and start scripts bind to loopback only', async () => {
    const pkg = JSON.parse(await (await import('node:fs/promises')).readFile(path.join(__dirname, '../../package.json'), 'utf8'));
    expect(pkg.scripts.dev).toContain('-H 127.0.0.1');
    expect(pkg.scripts.start).toContain('-H 127.0.0.1');
  });
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
