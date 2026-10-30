import { NextResponse } from 'next/server';
import { readChat } from '@/lib/app/feedback';

type Ctx = { params: Promise<{ id: string }> };

/** The project's feedback chat, oldest first. */
export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  return NextResponse.json({ messages: await readChat(id) });
}
