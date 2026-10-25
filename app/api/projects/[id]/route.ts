import { NextResponse } from 'next/server';
import { NotFoundError, getProject, listVersions } from '@/lib/app/workspace/store';

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
