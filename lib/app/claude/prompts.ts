import type { Preferences, Project, VersionOrigin } from '@/lib/app/workspace/schema';
import { PRESET_SKILL, replyLine } from './install';

export type Stage = 'analyse' | 'plan' | 'revise';

export type PromptCtx = {
  project: Project;
  preferences: Preferences;
  versions: VersionOrigin[];
  request?: string;
  userDiffs?: unknown[];
};

function selectionLines(p: Project): string {
  const s = p.selection;
  if (!s) return 'No option cards are chosen yet: stop and say so.';
  return [
    `Use ONLY these option cards: captions ${s.captions}; layouts ${s.layouts.join(', ') || 'none'}; cards ${s.cards.join(', ') || 'none'}.`,
    `SFX ${s.sfx ? 'on' : 'off'}; music ${s.music ? 'on (write 3–4 candidates, the user picks)' : 'off'}; punch-ins ${s.punchIns ? 'allowed (max 2)' : 'off'}; topic assets ${s.topicAssets ? 'on' : 'off'}.`,
  ].join('\n');
}

function preferenceLines(prefs: Preferences): string {
  return prefs.rules.length ? `Learned preferences (they override preset defaults):\n${prefs.rules.map((r) => `- ${r.text}`).join('\n')}` : '';
}

export function buildPrompt(stage: Stage, ctx: PromptCtx): string {
  const { project } = ctx;
  const skill = PRESET_SKILL[project.preset];
  const head = `Project "${project.name}" (${project.preset}, ratios ${project.ratios.join(', ')}). Load the video-core and ${skill} skills.`;
  const motion =
    project.preset === 'talking-head'
      ? 'While someone is speaking, something visual must change at least every 3 s: run `rf gaps plan.json` and fix every gap before saving.'
      : '';
  const latest = ctx.versions.at(-1)?.n ?? null;
  const lastClaude = [...ctx.versions].reverse().find((v) => v.by === 'claude')?.n ?? 0;
  const diffs = ctx.userDiffs ?? ctx.versions.filter((v) => v.by === 'user' && v.n > lastClaude).map((v) => v.diff);

  let body: string;
  if (stage === 'analyse') {
    body = [
      `Stage: analyse. Inventory inputs/, run the ${skill} analysis steps with rf and write the results under analysis/.`,
      project.selection?.music ? 'Music is on: write analysis/music-candidates.json (3–4 royalty-free tracks).' : '',
      'Do not write a plan yet. End with a short summary of what you found.',
    ].join('\n');
  } else if (stage === 'plan') {
    body = [
      `Stage: plan. Write plan.json following the ${skill} skill.`,
      selectionLines(project),
      motion,
      'Then run `rf validate plan.json` and fix every error, then `rf save plan.json --request "first cut"`.',
    ].join('\n');
  } else {
    body = [
      `Stage: revise. Apply this request to version v${latest ?? '?'}, verbatim from the user:`,
      `"""${ctx.request ?? ''}"""`,
      diffs.length ? `The user also edited the plan by hand since your last version; treat these as preferences:\n${JSON.stringify(diffs)}` : '',
      selectionLines(project),
      motion,
      `Read the latest plan with \`rf project\`, edit plan.json, \`rf validate\`, then \`rf save plan.json --parent ${latest ?? 1} --request "<one line on what changed>"\`.`,
      'If the request states a lasting preference, end your reply with a line "PREFERENCE: <text>".',
    ].join('\n');
  }
  return [head, preferenceLines(ctx.preferences), body, replyLine(project.lang)].filter(Boolean).join('\n\n');
}
