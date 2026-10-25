import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { z } from 'zod';

export class WorkspaceCorruptError extends Error {
  constructor(readonly file: string, detail: string) {
    super(`${file}: ${detail}`);
    this.name = 'WorkspaceCorruptError';
  }
}

/** Reads and validates a JSON file; null when it does not exist. */
export async function readJson<T>(file: string, schema: z.ZodType<T, z.ZodTypeDef, unknown>): Promise<T | null> {
  let raw: string;
  try {
    raw = await readFile(file, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new WorkspaceCorruptError(file, (error as Error).message);
  }
  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new WorkspaceCorruptError(file, result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  }
  return result.data;
}

/** Writes via a temp file and rename, so readers never see a half-written file. */
export async function writeJson(file: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${randomUUID()}.tmp`;
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(temp, file);
}
