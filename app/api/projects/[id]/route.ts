import { NextResponse } from 'next/server';
import { z } from 'zod';
import { SelectionSchema } from '@/lib/plan/schema';
import { NotFoundError, getProject, listVersions, updateProject } from '@/lib/app/workspace/store';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    return NextResponse.json({ project: await getProject(id), versions: await listVersions(id) });
  } catch (err) {
    if (err instanceof NotFoundError) return NextResponse.json({ error: err.message }, { status: 404 });
    throw err;
  }
}

const Patch = z.object({ selection: SelectionSchema });

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  try {
    return NextResponse.json(await updateProject(id, { selection: parsed.data.selection }));
  } catch (err) {
    if (err instanceof NotFoundError) return NextResponse.json({ error: err.message }, { status: 404 });
    throw err;
  }
}
