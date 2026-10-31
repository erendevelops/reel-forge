import { NextResponse } from 'next/server';
import { z } from 'zod';
import { RATIOS, SelectionSchema } from '@/lib/plan/schema';
import { ProjectSchema } from '@/lib/app/workspace/schema';
import { buildPrompt } from '@/lib/app/claude/prompts';
import { installSkills } from '@/lib/app/claude/install';
import { projectDir } from '@/lib/app/workspace/paths';
import { JobBusyError, startJob } from '@/lib/app/jobs/jobs';
import '@/lib/app/jobs/render-job'; // the auto-draft after a fresh plan needs the render executor
import { NotFoundError, getPreferences, getProject, listVersions, readVersion, updateProject } from '@/lib/app/workspace/store';

type Ctx = { params: Promise<{ id: string }> };

/** Order-free JSON for comparing choices (key and list order don't matter). */
const stable = (v: unknown): string =>
  JSON.stringify(v, (_k, x) => (Array.isArray(x) ? [...x].sort() : x && typeof x === 'object' ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x));

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
      // After the first plan, cards that differ from the ones the newest plan was built with (or new reference
      // reels) mean a new plan from scratch. Compared with the plan, not the last save: a save that met a busy job
      // already stored the cards, and the retry must still re-plan.
      const planned = (await readVersion(id, versions.at(-1)!.n)).plan.selection;
      const changed = stable(planned) !== stable(project.selection) || stable(before.references) !== stable(project.references);
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
