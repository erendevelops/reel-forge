import path from 'node:path';
import { z } from 'zod';
import { readJson, writeJson } from './workspace/files';
import { workspaceDir } from './workspace/paths';

const SettingsSchema = z.object({
  language: z.enum(['tr', 'en']),
  claudeBinary: z.string().min(1),
});

export type Settings = z.infer<typeof SettingsSchema>;

const DEFAULTS: Settings = { language: 'tr', claudeBinary: 'claude' };

function file(): string {
  return path.join(workspaceDir(), 'settings.json');
}

export async function getSettings(): Promise<Settings> {
  return { ...DEFAULTS, ...((await readJson(file(), SettingsSchema.partial())) ?? {}) };
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = SettingsSchema.parse({ ...(await getSettings()), ...patch });
  await writeJson(file(), next);
  return next;
}
