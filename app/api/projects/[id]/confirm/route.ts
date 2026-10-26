import { NextResponse } from 'next/server';
import { z } from 'zod';
import { RATIOS, SelectionSchema } from '@/lib/plan/schema';
import { ProjectSchema } from '@/lib/app/workspace/schema';
import { buildPrompt } from '@/lib/app/claude/prompts';
import { JobBusyError, startJob } from '@/lib/app/jobs/jobs';
import { NotFoundError, getPreferences, listVersions, updateProject } from '@/lib/app/workspace/store';

type Ctx = { params: Promise<{ id: string }> };

const Body = z.object({ selection: SelectionSchema, ratios: z.array(z.enum(RATIOS)).min(1), references: ProjectSchema.shape.references });

/** "Confirm and analyse": stores the option cards (with ratios and reference reels) and starts the analyse job. */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  try {
    const project = await updateProject(id, { ...parsed.data, cardsConfirmed: true });
    const versions = await listVersions(id);
    // after the first plan, changing cards only saves them
    if (versions.length) return NextResponse.json({ jobId: null }, { status: 200 });
    const prompt = buildPrompt('analyse', { project, preferences: await getPreferences(), versions });
    return NextResponse.json(await startJob(id, { kind: 'claude', prompt }), { status: 201 });
  } catch (err) {
    if (err instanceof JobBusyError) return NextResponse.json({ error: err.message }, { status: 409 });
    if (err instanceof NotFoundError) return NextResponse.json({ error: err.message }, { status: 404 });
    throw err;
  }
}
