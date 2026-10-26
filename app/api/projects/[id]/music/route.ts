import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { CandidatesSchema, MUSIC_MAX_BYTES, safeMusicName } from '@/lib/app/music';
import { projectDir } from '@/lib/app/workspace/paths';
import { NotFoundError, getProject, updateProject } from '@/lib/app/workspace/store';

type Ctx = { params: Promise<{ id: string }> };

async function candidates(id: string) {
  const raw = await readFile(path.join(projectDir(id), 'analysis', 'music-candidates.json'), 'utf8').catch(() => null);
  return raw ? CandidatesSchema.parse(JSON.parse(raw)) : { candidates: [] };
}

function failed(err: unknown) {
  if (err instanceof NotFoundError) return NextResponse.json({ error: err.message }, { status: 404 });
  throw err;
}

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const project = await getProject(id);
    const c = await candidates(id);
    return NextResponse.json({ candidates: c.candidates, note: c.note ?? null, picked: project.music });
  } catch (err) {
    return failed(err);
  }
}

const Pick = z.object({ pick: z.number().int().nonnegative() });

/** Records the user's pick from Claude's candidates; the file comes with PUT. */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const parsed = Pick.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  try {
    const c = (await candidates(id)).candidates[parsed.data.pick];
    if (!c) return NextResponse.json({ error: `no candidate ${parsed.data.pick}` }, { status: 400 });
    const project = await updateProject(id, { music: { title: c.title, url: c.url, license: c.license, file: null } });
    return NextResponse.json(project.music);
  } catch (err) {
    return failed(err);
  }
}

/** The track file (multipart `file`, at most 50 MB), saved under a safe name in inputs/music/. */
export async function PUT(req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const project = await getProject(id);
    const declared = Number(req.headers.get('content-length') ?? 0);
    if (declared > MUSIC_MAX_BYTES + 64 * 1024) return NextResponse.json({ error: 'file is over 50 MB' }, { status: 413 });
    const form = await req.formData().catch(() => null);
    const file = form?.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'multipart field "file" is missing' }, { status: 400 });
    if (file.size > MUSIC_MAX_BYTES) return NextResponse.json({ error: 'file is over 50 MB' }, { status: 413 });
    let name: string;
    try {
      name = safeMusicName(file.name);
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 400 });
    }
    const dir = path.join(projectDir(id), 'inputs', 'music');
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
    const music = project.music ? { ...project.music, file: name } : { title: file.name, url: null, license: 'user upload', file: name };
    return NextResponse.json((await updateProject(id, { music })).music);
  } catch (err) {
    return failed(err);
  }
}
