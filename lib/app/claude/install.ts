import { cp, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Selection } from '@/lib/plan/schema';
import { repoPath } from '@/lib/root';
import type { Preferences, Preset, Project } from '@/lib/app/workspace/schema';

export const PRESET_SKILL: Record<Preset, string> = {
  faceless: 'reel-faceless',
  'talking-head': 'reel-talking-head',
  'app-video': 'app-video',
};

/** Option cards a new project starts with; Plan 4's option-card screen replaces them. */
export function defaultSelection(preset: Preset): Selection {
  switch (preset) {
    case 'faceless': // the faceless preset's proven defaults
      return { captions: 'word-build', layouts: ['broll'], cards: ['title-card', 'numbered-list', 'logo-pop'], sfx: true, music: false, punchIns: true, thumbnail: true, topicAssets: false };
    case 'talking-head':
      return {
        captions: 'word-build',
        layouts: ['full-face', 'split', 'full-graphics'],
        cards: ['rolling-number', 'checklist', 'stamp', 'bar-chart', 'typed-title', 'logo-pop', 'follow-outro', 'custom-animation'],
        sfx: true, music: false, punchIns: false, thumbnail: true, topicAssets: true,
      };
    case 'app-video':
      return { captions: 'none', layouts: ['full-graphics'], cards: ['custom-animation', 'rolling-number', 'checklist', 'typed-title'], sfx: true, music: true, punchIns: false, thumbnail: true, topicAssets: true };
  }
}

const LANG_NAME = { tr: 'Türkçe', en: 'English' } as const;

export function replyLine(lang: 'tr' | 'en'): string {
  return `Reply in ${LANG_NAME[lang]}.`;
}

/** The project brief Claude reads first in every job. */
export function claudeMd(project: Project, prefs: Preferences): string {
  const sel = project.selection;
  return [
    `# ${project.name}`,
    '',
    `- Preset: ${project.preset} (skill: ${PRESET_SKILL[project.preset]}, plus video-core)`,
    `- Ratios: ${project.ratios.join(', ')}`,
    `- Language: ${LANG_NAME[project.lang]}`,
    '',
    '## Option cards (use only these)',
    sel
      ? [
          `- Captions: ${sel.captions}`,
          `- Layouts: ${sel.layouts.join(', ') || '—'}`,
          `- Cards: ${sel.cards.join(', ') || '—'}`,
          `- SFX: ${sel.sfx ? 'yes' : 'no'} · Music: ${sel.music ? 'yes (suggest 3–4, the user picks)' : 'no'} · Punch-ins: ${sel.punchIns ? 'yes' : 'no'} · Thumbnail: ${sel.thumbnail ? 'yes' : 'no'} · Topic assets: ${sel.topicAssets ? 'yes' : 'no'}`,
        ].join('\n')
      : '- (not chosen yet)',
    '',
    '## Learned preferences (override preset defaults)',
    prefs.rules.length ? prefs.rules.map((r) => `- ${r.text}`).join('\n') : '- (none yet)',
    '',
    '## How to work',
    '- Use `rf` for every mechanical step (`rf <command>` prints JSON); never render, never write outside this folder.',
    '- Finish a plan with `rf save plan.json`; it validates and stores a new version, and the app renders a draft.',
    `- ${replyLine(project.lang)}`,
    '',
  ].join('\n');
}

export async function writeClaudeMd(project: Project, prefs: Preferences, dir: string): Promise<void> {
  await writeFile(path.join(dir, 'CLAUDE.md'), claudeMd(project, prefs), 'utf8');
}

/** Copies video-core + the preset skill into the project, writes CLAUDE.md and the `rf` shims. */
export async function installSkills(project: Project, prefs: Preferences, dir: string): Promise<void> {
  const skills = path.join(dir, '.claude', 'skills');
  await mkdir(skills, { recursive: true });
  for (const name of ['video-core', PRESET_SKILL[project.preset]]) {
    await cp(repoPath('skills', name), path.join(skills, name), { recursive: true });
  }
  await writeClaudeMd(project, prefs, dir);
  const tsx = repoPath('node_modules', 'tsx', 'dist', 'cli.mjs');
  const tsconfig = repoPath('tsconfig.json');
  const rf = repoPath('scripts', 'rf.ts');
  // tsx resolves the @/ alias from --tsconfig: rf runs with cwd = this project folder.
  await writeFile(path.join(dir, 'rf.cmd'), `@echo off\r\nchcp 65001 >nul\r\nnode "${tsx}" --tsconfig "${tsconfig}" "${rf}" %*\r\n`, 'utf8');
  await writeFile(path.join(dir, 'rf'), `#!/bin/sh\nexec node "${tsx}" --tsconfig "${tsconfig}" "${rf}" "$@"\n`, { encoding: 'utf8', mode: 0o755 });
}
