import path from 'node:path';
import { projectDir } from '@/lib/app/workspace/paths';

/** The project an `rf` run belongs to: REELFORGE_PROJECT (set by the job runner). */
export function projectId(): string {
  const id = process.env.REELFORGE_PROJECT;
  if (!id) throw new Error('REELFORGE_PROJECT is not set (rf runs inside a project job)');
  return id;
}

export function root(): string {
  return projectDir(projectId());
}

/** Resolves `p` against the project folder; anything outside it is refused. */
export function resolveInProject(p: string): string {
  const base = path.resolve(root());
  const full = path.resolve(base, p);
  const rel = path.relative(base, full);
  if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error(`path outside project: ${p}`);
  return full;
}

/** `--name value` flags and positional args. */
export function parseArgs(args: string[]): { pos: string[]; flags: Record<string, string> } {
  const pos: string[] = [];
  const flags: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) flags[args[i].slice(2)] = args[i + 1] ?? '';
    else pos.push(args[i]);
    if (args[i].startsWith('--')) i++;
  }
  return { pos, flags };
}
