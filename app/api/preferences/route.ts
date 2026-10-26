import { NextResponse } from 'next/server';
import { z } from 'zod';
import { PreferenceIndexError, addPreference, getPreferences, removePreference, updatePreference } from '@/lib/app/workspace/store';

const text = z.string().trim().min(1).max(500);
const Add = z.object({ text, source: z.string().min(1).max(200) });
const Edit = z.object({ index: z.number().int().nonnegative(), text });
const Remove = z.object({ index: z.number().int().nonnegative() });

async function body<T>(req: Request, schema: z.ZodType<T>): Promise<T | NextResponse> {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  return parsed.success ? parsed.data : NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
}

async function guarded(run: () => Promise<unknown>, status = 200) {
  try {
    return NextResponse.json(await run(), { status });
  } catch (err) {
    if (err instanceof PreferenceIndexError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}

/** Learned preferences (spec §9): listed and edited in Settings; added when the user accepts Claude's offer. */
export async function GET() {
  return NextResponse.json(await getPreferences());
}

export async function POST(req: Request) {
  const b = await body(req, Add);
  return b instanceof NextResponse ? b : guarded(() => addPreference(b), 201);
}

export async function PATCH(req: Request) {
  const b = await body(req, Edit);
  return b instanceof NextResponse ? b : guarded(() => updatePreference(b.index, b.text));
}

export async function DELETE(req: Request) {
  const b = await body(req, Remove);
  return b instanceof NextResponse ? b : guarded(() => removePreference(b.index));
}
