import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DELETE, GET, PATCH, POST } from '../../app/api/preferences/route';

let ws: string;
beforeEach(async () => {
  ws = await mkdtemp(path.join(os.tmpdir(), 'rf-prefs-'));
  process.env.REELFORGE_WORKSPACE = ws;
});
afterEach(async () => {
  delete process.env.REELFORGE_WORKSPACE;
  await rm(ws, { recursive: true, force: true });
});

const req = (method: string, body: unknown) => new Request('http://localhost/api/preferences', { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

describe('/api/preferences', () => {
  it('adds, edits and deletes rules by index', async () => {
    expect((await POST(req('POST', { text: 'Liste daha sağda olsun', source: 'p1' }))).status).toBe(201);
    await POST(req('POST', { text: 'Daha az kesme', source: 'p2' }));
    expect((await PATCH(req('PATCH', { index: 0, text: 'Liste sağda' }))).status).toBe(200);
    expect((await DELETE(req('DELETE', { index: 1 }))).status).toBe(200);
    const { rules } = await (await GET()).json();
    expect(rules.map((r: { text: string }) => r.text)).toEqual(['Liste sağda']);
  });

  it('refuses an index that does not exist and an empty rule', async () => {
    expect((await PATCH(req('PATCH', { index: 99, text: 'x' }))).status).toBe(400);
    expect((await DELETE(req('DELETE', { index: 99 }))).status).toBe(400);
    expect((await POST(req('POST', { text: '  ', source: 'p' }))).status).toBe(400);
  });
});
