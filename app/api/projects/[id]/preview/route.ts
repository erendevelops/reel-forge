import { NextResponse } from 'next/server';
import { z } from 'zod';
import { RATIOS } from '@/lib/plan/schema';
import { buildPreview } from '@/lib/preview/build';
import { NotFoundError } from '@/lib/app/workspace/store';

type Ctx = { params: Promise<{ id: string }> };

const Body = z.object({ plan: z.unknown(), ratio: z.enum(RATIOS) });

/** Builds the live preview of a (possibly unsaved) plan for one ratio; returns the URL to load in the iframe. */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  try {
    return NextResponse.json(await buildPreview(id, parsed.data.plan, parsed.data.ratio));
  } catch (err) {
    if (err instanceof NotFoundError) return NextResponse.json({ error: err.message }, { status: 404 });
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
