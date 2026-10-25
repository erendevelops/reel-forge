import { NextResponse } from 'next/server';
import { JobBusyError, resumeJob } from '@/lib/app/jobs/jobs';

type Ctx = { params: Promise<{ id: string; jobId: string }> };

export async function POST(_req: Request, { params }: Ctx) {
  const { id, jobId } = await params;
  try {
    return NextResponse.json(await resumeJob(id, jobId), { status: 201 });
  } catch (err) {
    if (err instanceof JobBusyError) return NextResponse.json({ error: err.message }, { status: 409 });
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
