import { NextResponse } from 'next/server';
import { z } from 'zod';
import { buildPrompt } from '@/lib/app/claude/prompts';
import { JobBusyError, startJob } from '@/lib/app/jobs/jobs';
import '@/lib/app/jobs/render-job'; // the auto-draft after a plan needs the render executor
import { NotFoundError, getPreferences, getProject, listVersions } from '@/lib/app/workspace/store';

type Ctx = { params: Promise<{ id: string }> };

const Body = z.object({ stage: z.enum(['analyse', 'plan', 'revise']), request: z.string().max(4000).optional() }).refine((b) => b.stage !== 'revise' || !!b.request?.trim(), {
  message: 'revise needs a request',
  path: ['request'],
});

export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  try {
    const [project, preferences, versions] = await Promise.all([getProject(id), getPreferences(), listVersions(id)]);
    const prompt = buildPrompt(parsed.data.stage, { project, preferences, versions, request: parsed.data.request });
    return NextResponse.json(await startJob(id, { kind: 'claude', prompt }), { status: 201 });
  } catch (err) {
    if (err instanceof JobBusyError) return NextResponse.json({ error: err.message }, { status: 409 });
    if (err instanceof NotFoundError) return NextResponse.json({ error: err.message }, { status: 404 });
    throw err;
  }
}
