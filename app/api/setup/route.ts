import { NextResponse } from 'next/server';
import { z } from 'zod';
import { claudeCommand, getSettings } from '@/lib/app/settings';
import { downloadFaceModel, runChecks } from '@/lib/app/setup/checks';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { language } = await getSettings();
  return NextResponse.json(await runChecks({ lang: language, claudeBinary: await claudeCommand() }));
}

const Body = z.object({ action: z.literal('download-face-model') });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  try {
    await downloadFaceModel();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
