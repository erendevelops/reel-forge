import { NextResponse } from 'next/server';
import { z } from 'zod';
import { EditError, applyEdit, diffPlans, type Edit } from '@/lib/app/edits';
import { NotFoundError, listVersions, readVersion, saveVersion, validateForProject } from '@/lib/app/workspace/store';

type Ctx = { params: Promise<{ id: string }> };

const Body = z.object({ parent: z.number().int().positive(), edits: z.array(z.object({ op: z.string() }).passthrough()) });

/** Direct edits on version `parent` saved as a new user version (spec §8), with the diff in its origin. */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { parent, edits } = parsed.data;
  try {
    const base = (await readVersion(id, parent)).plan;
    const next = (edits as unknown as Edit[]).reduce(applyEdit, base);
    const v = await validateForProject(id, next);
    if (!v.ok) return NextResponse.json({ error: v.errors }, { status: 400 });
    const latest = (await listVersions(id)).at(-1)?.n ?? parent;
    const n = await saveVersion(id, { plan: v.plan, by: 'user', parent, request: null, diff: diffPlans(base, v.plan) });
    return NextResponse.json({ n, parent, branched: parent !== latest }, { status: 201 });
  } catch (err) {
    if (err instanceof EditError) return NextResponse.json({ error: [err.message] }, { status: 400 });
    if (err instanceof NotFoundError) return NextResponse.json({ error: err.message }, { status: 404 });
    throw err;
  }
}
