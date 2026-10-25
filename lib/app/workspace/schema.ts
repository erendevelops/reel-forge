import { z } from 'zod';
import { RATIOS, SelectionSchema } from '@/lib/plan/schema';

export const PRESETS = ['faceless', 'talking-head', 'app-video'] as const;
export type Preset = (typeof PRESETS)[number];

export const ProjectSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  mode: z.enum(['reel', 'app']),
  preset: z.enum(PRESETS),
  ratios: z.array(z.enum(RATIOS)).min(1),
  lang: z.enum(['tr', 'en']),
  selection: SelectionSchema.nullable(),
  claudeSession: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Project = z.infer<typeof ProjectSchema>;

export const NewProjectSchema = ProjectSchema.pick({ name: true, mode: true, preset: true, ratios: true, lang: true }).extend({
  inputs: z.array(z.string().min(1)),
});
export type NewProject = z.infer<typeof NewProjectSchema>;

export const VersionOriginSchema = z.object({
  n: z.number().int().positive(),
  by: z.enum(['claude', 'user']),
  parent: z.number().int().positive().nullable(),
  request: z.string().nullable(),
  diff: z.unknown().nullable(),
  createdAt: z.string(),
});
export type VersionOrigin = z.infer<typeof VersionOriginSchema>;

export const PreferencesSchema = z.object({
  rules: z.array(z.object({ text: z.string(), addedAt: z.string(), source: z.string() })),
});
export type Preferences = z.infer<typeof PreferencesSchema>;
