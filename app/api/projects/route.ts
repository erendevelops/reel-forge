import { NextResponse } from 'next/server';
import { NewProjectSchema } from '@/lib/app/workspace/schema';
import { createProject, listProjects } from '@/lib/app/workspace/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(await listProjects());
}

const Body = NewProjectSchema.refine((p) => (p.preset === 'app-video') === (p.mode === 'app'), {
  message: 'preset does not match mode',
  path: ['preset'],
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  try {
    return NextResponse.json(await createProject(parsed.data), { status: 201 });
  } catch (err) {
    // A missing or unreadable input path is the user's to fix, not a server fault.
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return NextResponse.json({ error: (err as Error).message }, { status: 400 });
    throw err;
  }
}
