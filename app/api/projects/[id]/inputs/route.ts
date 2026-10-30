import { createWriteStream } from 'node:fs';
import { mkdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';
import { NextResponse } from 'next/server';
import { isSkipped, safeRelPath } from '@/lib/app/upload';
import { projectDir } from '@/lib/app/workspace/paths';
import { NotFoundError, getProject } from '@/lib/app/workspace/store';

type Ctx = { params: Promise<{ id: string }> };

/**
 * One imported file (`?path=<relative path>`, raw body): streamed straight to `inputs/<path>`, never held in memory,
 * so multi-gigabyte footage is fine. Dependency/build folders are skipped (204).
 */
export async function PUT(req: Request, { params }: Ctx) {
  const { id } = await params;
  const rel = safeRelPath(new URL(req.url).searchParams.get('path') ?? '');
  if (!rel) return NextResponse.json({ error: 'missing or invalid path' }, { status: 400 });
  if (isSkipped(rel)) return new Response(null, { status: 204 });
  if (!req.body) return NextResponse.json({ error: 'empty body' }, { status: 400 });
  try {
    await getProject(id);
    const dest = path.join(projectDir(id), 'inputs', ...rel.split('/'));
    await mkdir(path.dirname(dest), { recursive: true });
    await pipeline(Readable.fromWeb(req.body as unknown as WebReadableStream), createWriteStream(dest));
    // never keep a silently truncated copy (a proxy limit cut the body short)
    const expected = Number(req.headers.get('content-length') ?? NaN);
    const got = (await stat(dest)).size;
    if (Number.isFinite(expected) && got !== expected) {
      await rm(dest, { force: true });
      return NextResponse.json({ error: `${rel}: received ${got} of ${expected} bytes` }, { status: 413 });
    }
    return NextResponse.json({ path: rel }, { status: 201 });
  } catch (err) {
    if (err instanceof NotFoundError) return NextResponse.json({ error: err.message }, { status: 404 });
    throw err;
  }
}
