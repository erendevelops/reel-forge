import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { analysisState } from '@/lib/app/flow';
import { TranscriptEditError, TranscriptSchema, applyWordEdits } from '@/lib/app/transcript';
import { projectDir } from '@/lib/app/workspace/paths';
import { NotFoundError, getProject, updateProject } from '@/lib/app/workspace/store';

type Ctx = { params: Promise<{ id: string }> };

async function load(id: string) {
  await getProject(id);
  const { transcriptFile } = await analysisState(id);
  if (!transcriptFile) return null;
  const file = path.join(projectDir(id), ...transcriptFile.split('/'));
  return { rel: transcriptFile, file, transcript: TranscriptSchema.parse(JSON.parse(await readFile(file, 'utf8'))) };
}

function failed(err: unknown) {
  if (err instanceof NotFoundError) return NextResponse.json({ error: err.message }, { status: 404 });
  throw err;
}

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const t = await load(id);
    if (!t) return NextResponse.json({ error: 'no transcript yet' }, { status: 404 });
    return NextResponse.json({ file: t.rel, transcript: t.transcript });
  } catch (err) {
    return failed(err);
  }
}

const Body = z.object({ words: z.array(z.string()) });

/** Saves corrected words (timings kept) and marks the transcript as checked. */
export async function PUT(req: Request, { params }: Ctx) {
  const { id } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  try {
    const t = await load(id);
    if (!t) return NextResponse.json({ error: 'no transcript yet' }, { status: 404 });
    const next = applyWordEdits(t.transcript, parsed.data.words);
    await writeFile(t.file, JSON.stringify(next), 'utf8');
    await updateProject(id, { transcriptChecked: true });
    return NextResponse.json({ file: t.rel, transcript: next });
  } catch (err) {
    if (err instanceof TranscriptEditError) return NextResponse.json({ error: err.message }, { status: 400 });
    return failed(err);
  }
}
