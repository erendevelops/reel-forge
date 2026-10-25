import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSettings, saveSettings } from '@/lib/app/settings';

export async function GET() {
  return NextResponse.json(await getSettings());
}

const Patch = z.object({ language: z.enum(['tr', 'en']).optional(), claudeBinary: z.string().min(1).optional() });

export async function POST(req: Request) {
  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  return NextResponse.json(await saveSettings(parsed.data));
}
