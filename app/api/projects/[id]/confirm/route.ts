import { NextResponse } from 'next/server';
import { z } from 'zod';
import { RATIOS, SelectionSchema } from '@/lib/plan/schema';
import { ProjectSchema } from '@/lib/app/workspace/schema';
import { buildPrompt } from '@/lib/app/claude/prompts';
import { installSkills } from '@/lib/app/claude/install';
import { projectDir } from '@/lib/app/workspace/paths';
import { JobBusyError, startJob } from '@/lib/app/jobs/jobs';
import '@/lib/app/jobs/render-job'; // the auto-draft after a fresh plan needs the render executor
import { NotFoundError, getPreferences, getProject, listVersions, updateProject } from '@/lib/app/workspace/store';

type Ctx = { params: Promise<{ id: string }> };

const Body = z.object({ selection: SelectionSchema, ratios: z.array(z.enum(RATIOS)).min(1), references: ProjectSchema.shape.references });

/** "Confirm and analyse": stores the option cards (with ratios and reference reels) and starts the analyse job. */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  try {
    // the choice is saved even when busy; the project only moves past the cards once the analysis has started
    const before = await getProject(id);
    const project = await updateProject(id, parsed.data);
    const [versions, preferences] = await Promise.all([listVersions(id), getPreferences()]);
    await installSkills(project, preferences, projectDir(id)); // CLAUDE.md lists the new cards
    if (versions.length) {
      // after the first plan, a real change of cards or references means a new plan built from scratch
      const changed = JSON.stringify([before.selection, before.references]) !== JSON.stringify([project.selection, project.references]);
      if (!changed) return NextResponse.json({ jobId: null }, { status: 200 });
      const job = await startJob(id, { kind: 'claude', prompt: buildPrompt('plan', { project, preferences, versions, fresh: true }) });
      return NextResponse.json(job, { status: 201 });
    }
    const prompt = buildPrompt('analyse', { project, preferences, versions });
    const job = await startJob(id, { kind: 'claude', prompt });
    await updateProject(id, { cardsConfirmed: true });
    return NextResponse.json(job, { status: 201 });
  } catch (err) {
    if (err instanceof JobBusyError) return NextResponse.json({ error: err.message }, { status: 409 });
    if (err instanceof NotFoundError) return NextResponse.json({ error: err.message }, { status: 404 });
    throw err;
  }
}
