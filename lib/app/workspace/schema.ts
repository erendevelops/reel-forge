import { z } from 'zod';
import { RATIOS, SelectionSchema } from '@/lib/plan/schema';

export const PRESETS = ['faceless', 'talking-head', 'app-video'] as const;
export type Preset = (typeof PRESETS)[number];

/** The music the user picked from Claude's candidates (or uploaded); `file` is set once it is in inputs/music/. */
export const MusicPickSchema = z.object({ title: z.string(), url: z.string().nullable(), license: z.string(), file: z.string().nullable() });
export type MusicPick = z.infer<typeof MusicPickSchema>;

export const ProjectSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  mode: z.enum(['reel', 'app']),
  preset: z.enum(PRESETS),
  ratios: z.array(z.enum(RATIOS)).min(1),
  lang: z.enum(['tr', 'en']),
  selection: SelectionSchema.nullable(),
  claudeSession: z.string().nullable(),
  /** Flow flags (Plan 4); defaults keep project.json files from before them parsing. */
  cardsConfirmed: z.boolean().default(false),
  transcriptChecked: z.boolean().default(false),
  music: MusicPickSchema.nullable().default(null),
  /** Reference reels the user pasted (spec §11 screen 3); https only. */
  references: z.array(z.string().url().regex(/^https:\/\//, 'must be an https URL')).max(5).default([]),
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
