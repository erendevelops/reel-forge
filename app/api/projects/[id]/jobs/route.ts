import { NextResponse } from 'next/server';
import { z } from 'zod';
import { JobBusyError, listJobs, startJob } from '@/lib/app/jobs/jobs';
import { NotFoundError } from '@/lib/app/workspace/store';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  return NextResponse.json(await listJobs(id));
}

const Body = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('claude'), prompt: z.string().min(1) }),
  z.object({ kind: z.literal('render'), version: z.number().int().positive(), profile: z.enum(['draft', 'final']) }),
]);

export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  try {
    return NextResponse.json(await startJob(id, parsed.data), { status: 201 });
  } catch (err) {
    if (err instanceof JobBusyError) return NextResponse.json({ error: err.message }, { status: 409 });
    if (err instanceof NotFoundError) return NextResponse.json({ error: err.message }, { status: 404 });
    throw err;
  }
}
