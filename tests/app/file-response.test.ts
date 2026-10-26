import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileResponse } from '../../lib/app/http/file-response';

let root: string;
beforeAll(async () => {
  // a project path with a non-ASCII folder, like OneDrive/Masaüstü
  root = path.join(await mkdtemp(path.join(os.tmpdir(), 'rf-files-')), 'Masaüstü proje');
  await mkdir(path.join(root, 'render'), { recursive: true });
  await writeFile(path.join(root, 'render', 'a.mp4'), Buffer.from('0123456789'));
  await writeFile(path.join(root, 'index.html'), '<p>hi</p>');
});
afterAll(async () => rm(path.dirname(root), { recursive: true, force: true }));

const req = (range?: string) => new Request('http://localhost/x', { headers: range ? { range } : {} });

describe('fileResponse', () => {
  it('serves a whole file with its type', async () => {
    const res = await fileResponse(root, 'render/a.mp4', req());
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('video/mp4');
    expect(res.headers.get('accept-ranges')).toBe('bytes');
    expect(await res.text()).toBe('0123456789');
    expect((await fileResponse(root, 'index.html', req())).headers.get('content-type')).toMatch(/^text\/html/);
  });

  it('answers byte ranges with 206 and exact lengths', async () => {
    const res = await fileResponse(root, 'render/a.mp4', req('bytes=2-5'));
    expect(res.status).toBe(206);
    expect(res.headers.get('content-range')).toBe('bytes 2-5/10');
    expect(res.headers.get('content-length')).toBe('4');
    expect(await res.text()).toBe('2345');
    const open = await fileResponse(root, 'render/a.mp4', req('bytes=7-'));
    expect(await open.text()).toBe('789');
    expect((await fileResponse(root, 'render/a.mp4', req('bytes=20-'))).status).toBe(416);
  });

  it('never leaves the root', async () => {
    for (const bad of ['../x', '%2e%2e/x', 'render/%2E%2E/%2E%2E/x', 'C:/Windows/win.ini', '/etc/passwd', 'render\\..\\..\\x']) {
      expect((await fileResponse(root, bad, req())).status, bad).toBe(404);
    }
    expect((await fileResponse(root, 'missing.mp4', req())).status).toBe(404);
  });
});
