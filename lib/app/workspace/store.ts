import { randomUUID } from 'node:crypto';
import { cp, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { PlanSchema, validatePlan, type Plan } from '@/lib/plan';
import { readJson, writeJson } from './files';
import { projectDir, projectsDir, versionDir, workspaceDir } from './paths';
import { createQueue } from './queue';
import {
  PreferencesSchema,
  ProjectSchema,
  VersionOriginSchema,
  type NewProject,
  type Preferences,
  type Project,
  type VersionOrigin,
} from './schema';

export class NotFoundError extends Error {
  constructor(what: string) {
    super(`not found: ${what}`);
    this.name = 'NotFoundError';
  }
}

const queues = new Map<string, ReturnType<typeof createQueue>>();
function queueFor(key: string) {
  let q = queues.get(key);
  if (!q) queues.set(key, (q = createQueue()));
  return q;
}

// Strictly increasing timestamps, so ordering by createdAt/updatedAt is total within a process.
let lastTs = 0;
function now(): string {
  lastTs = Math.max(Date.now(), lastTs + 1);
  return new Date(lastTs).toISOString();
}

const TR_MAP: Record<string, string> = { ş: 's', ç: 'c', ğ: 'g', ü: 'u', ö: 'o', ı: 'i', i̇: 'i' };
function slug(name: string): string {
  const base = name
    .toLocaleLowerCase('tr')
    .replace(/[şçğüöı]|i̇/g, (c) => TR_MAP[c] ?? c)
    .normalize('NFKD')
    .replace(/[^\x00-\x7f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `${base || 'project'}-${randomUUID().replace(/-/g, '').slice(0, 6)}`;
}

const projectFile = (id: string) => path.join(projectDir(id), 'project.json');

export async function createProject(input: NewProject): Promise<Project> {
  const ts = now();
  const project: Project = ProjectSchema.parse({
    id: slug(input.name),
    name: input.name,
    mode: input.mode,
    preset: input.preset,
    ratios: input.ratios,
    lang: input.lang,
    selection: null,
    claudeSession: null,
    createdAt: ts,
    updatedAt: ts,
  });
  const dir = projectDir(project.id);
  await mkdir(path.join(dir, 'inputs'), { recursive: true });
  for (const src of input.inputs) {
    // Copies keep the original name; the user's files are never modified.
    await cp(src, path.join(dir, 'inputs', path.basename(src)), { recursive: true, errorOnExist: false });
  }
  await writeJson(projectFile(project.id), project);
  return project;
}

export async function getProject(id: string): Promise<Project> {
  const p = await readJson(projectFile(id), ProjectSchema);
  if (!p) throw new NotFoundError(`project ${id}`);
  return p;
}

export async function listProjects(): Promise<Project[]> {
  let ids: string[];
  try {
    ids = (await readdir(projectsDir(), { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  const projects = await Promise.all(ids.map((id) => readJson(projectFile(id), ProjectSchema)));
  return projects.filter((p): p is Project => p !== null).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function updateProject(id: string, patch: Partial<Omit<Project, 'id' | 'createdAt'>>): Promise<Project> {
  return queueFor(id)(async () => {
    const next = ProjectSchema.parse({ ...(await getProject(id)), ...patch, id, updatedAt: now() });
    await writeJson(projectFile(id), next);
    return next;
  });
}

export async function listVersions(id: string): Promise<VersionOrigin[]> {
  let names: string[];
  try {
    names = await readdir(path.join(projectDir(id), 'versions'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  const ns = names.map((n) => /^v(\d+)$/.exec(n)?.[1]).filter(Boolean).map(Number).sort((a, b) => a - b);
  const origins = await Promise.all(ns.map((n) => readJson(path.join(versionDir(id, n), 'origin.json'), VersionOriginSchema)));
  return origins.filter((o): o is VersionOrigin => o !== null);
}

export function saveVersion(
  id: string,
  input: { plan: unknown; by: 'claude' | 'user'; parent: number | null; request?: string | null; diff?: unknown },
): Promise<number> {
  return queueFor(id)(async () => {
    await getProject(id);
    const result = validatePlan(input.plan);
    if (!result.ok) throw new Error(`invalid plan:\n${result.errors.join('\n')}`);
    const versions = await listVersions(id);
    const n = (versions.at(-1)?.n ?? 0) + 1;
    const origin: VersionOrigin = {
      n,
      by: input.by,
      parent: input.parent,
      request: input.request ?? null,
      diff: input.diff ?? null,
      createdAt: now(),
    };
    await writeJson(path.join(versionDir(id, n), 'plan.json'), result.plan);
    await writeJson(path.join(versionDir(id, n), 'origin.json'), origin);
    return n;
  });
}

export async function readVersion(id: string, n: number): Promise<{ plan: Plan; origin: VersionOrigin }> {
  const plan = await readJson(path.join(versionDir(id, n), 'plan.json'), PlanSchema);
  const origin = await readJson(path.join(versionDir(id, n), 'origin.json'), VersionOriginSchema);
  if (!plan || !origin) throw new NotFoundError(`version ${n} of ${id}`);
  return { plan, origin };
}

const prefsFile = () => path.join(workspaceDir(), 'preferences.json');

export async function getPreferences(): Promise<Preferences> {
  return (await readJson(prefsFile(), PreferencesSchema)) ?? { rules: [] };
}

export function addPreference(rule: { text: string; source: string }): Promise<Preferences> {
  return queueFor('__preferences')(async () => {
    const prefs = await getPreferences();
    const next = { rules: [...prefs.rules, { ...rule, addedAt: now() }] };
    await writeJson(prefsFile(), next);
    return next;
  });
}
