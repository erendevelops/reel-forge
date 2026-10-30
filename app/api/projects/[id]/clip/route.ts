import { readFile } from 'node:fs/promises';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { PickError, clipSources, cutPick, framePath } from '@/lib/app/clip-pick';
import { RATIOS } from '@/lib/plan/schema';
import { NotFoundError, getProject } from '@/lib/app/workspace/store';

type Ctx = { params: Promise<{ id: string }> };

/** The project's videos and their moments; with `?src=&t=`, a JPEG frame of that video at t seconds. */
export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;
  const q = new URL(req.url).searchParams;
  try {
    await getProject(id);
    const src = q.get('src');
    if (src === null) return NextResponse.json({ sources: await clipSources(id) });
    const jpg = await readFile(await framePath(id, src, Number(q.get('t'))));
    return new Response(new Uint8Array(jpg), { headers: { 'content-type': 'image/jpeg', 'cache-control': 'max-age=3600' } });
  } catch (err) {
    if (err instanceof NotFoundError) return NextResponse.json({ error: err.message }, { status: 404 });
    if (err instanceof PickError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}

const Body = z.object({ src: z.string(), from: z.number().finite(), duration: z.number().finite(), ratio: z.enum(RATIOS), fps: z.union([z.literal(30), z.literal(60)]) });

/** Cuts a moment of an input video into a working clip; the storyboard then swaps a shot to it (`shot-clip`). */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  try {
    await getProject(id);
    return NextResponse.json({ src: await cutPick(id, parsed.data) });
  } catch (err) {
    if (err instanceof NotFoundError) return NextResponse.json({ error: err.message }, { status: 404 });
    if (err instanceof PickError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
