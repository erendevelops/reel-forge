import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { projectDir } from './workspace/paths';
import { createQueue } from './workspace/queue';

/** One message of the project's feedback chat: the user's feedback, or Claude's reply after rebuilding. */
export const ChatMessageSchema = z.object({
  role: z.enum(['user', 'claude']),
  text: z.string(),
  at: z.string(),
  /** The version Claude's rebuild saved (claude messages). */
  version: z.number().int().positive().nullable().default(null),
  failed: z.boolean().default(false),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

const file = (id: string) => path.join(projectDir(id), 'feedback.json');
const queue = createQueue();

export async function readChat(id: string): Promise<ChatMessage[]> {
  const raw = await readFile(file(id), 'utf8').catch(() => null);
  if (!raw) return [];
  try {
    return z.array(ChatMessageSchema).parse(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function appendChat(id: string, m: Omit<ChatMessage, 'at' | 'version' | 'failed'> & Partial<Pick<ChatMessage, 'version' | 'failed'>>): Promise<ChatMessage[]> {
  return queue(async () => {
    const next = [...(await readChat(id)), ChatMessageSchema.parse({ ...m, at: new Date().toISOString() })];
    await writeFile(file(id), JSON.stringify(next, null, 2), 'utf8');
    return next;
  });
}

/** Claude's reply as the chat shows it: without the PREFERENCE line (the app offers that separately). */
export function chatReply(text: string): string {
  return text.replace(/^PREFERENCE:.*$/gm, '').replace(/\*\*|`/g, '').trim();
}
