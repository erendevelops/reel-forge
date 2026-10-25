import path from 'node:path';

/** Root of all app state. Tests point REELFORGE_WORKSPACE at a temp dir. */
export function workspaceDir(): string {
  return process.env.REELFORGE_WORKSPACE ?? path.join(process.cwd(), 'workspace');
}

export function projectsDir(): string {
  return path.join(workspaceDir(), 'projects');
}

export function projectDir(id: string): string {
  if (!/^[a-z0-9-]+$/.test(id)) throw new Error(`invalid project id: ${id}`);
  return path.join(projectsDir(), id);
}

export function versionDir(id: string, n: number): string {
  return path.join(projectDir(id), 'versions', `v${n}`);
}
