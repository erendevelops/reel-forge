import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { versionDir } from '@/lib/app/workspace/paths';
import { NotFoundError, readVersion } from '@/lib/app/workspace/store';

type Ctx = { params: Promise<{ id: string; n: string }> };

/** A version's plan and origin, its render files (as file-route URLs) and its QA reports. */
export async function GET(_req: Request, { params }: Ctx) {
  const { id, n: raw } = await params;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) return NextResponse.json({ error: 'bad version' }, { status: 400 });
  try {
    const { plan, origin } = await readVersion(id, n);
    const dir = path.join(versionDir(id, n), 'render');
    const names = await readdir(dir).catch(() => [] as string[]);
    const renders = names
      .map((f) => /^(draft|final)-(\d+)x(\d+)\.mp4$/.exec(f))
      .filter((m): m is RegExpExecArray => m !== null)
      .map((m) => ({ ratio: `${m[2]}:${m[3]}`, profile: m[1], url: `/api/projects/${id}/files/versions/v${n}/render/${m[0]}` }));
    const qa: Record<string, unknown> = {};
    for (const f of names.filter((x) => /^qa-.*\.json$/.test(x))) {
      qa[f.slice(3, -5)] = JSON.parse(await readFile(path.join(dir, f), 'utf8'));
    }
    const thumbs = names.filter((f) => /^thumbnail-.*\.jpg$/.test(f)).map((f) => `/api/projects/${id}/files/versions/v${n}/render/${f}`);
    return NextResponse.json({ plan, origin, renders, qa, thumbs });
  } catch (err) {
    if (err instanceof NotFoundError) return NextResponse.json({ error: err.message }, { status: 404 });
    throw err;
  }
}
