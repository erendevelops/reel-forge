import type { Preferences, Project, VersionOrigin } from '@/lib/app/workspace/schema';
import { PRESET_SKILL, replyLine } from './install';

export type Stage = 'analyse' | 'plan' | 'revise' | 'music' | 'rebuild';

export type PromptCtx = {
  project: Project;
  preferences: Preferences;
  versions: VersionOrigin[];
  request?: string;
  userDiffs?: unknown[];
  /** Plan again from scratch (the user changed the option cards or reference reels). */
  fresh?: boolean;
  /** The feedback chat so far, oldest first, the newest user message last (rebuild stage). */
  chat?: { role: 'user' | 'claude'; text: string }[];
};

function selectionLines(p: Project): string {
  const s = p.selection;
  if (!s) return 'No option cards are chosen yet: stop and say so.';
  return [
    `Use ONLY these option cards: captions ${s.captions}; layouts ${s.layouts.join(', ') || 'none'}; cards ${s.cards.join(', ') || 'none'}.`,
    `SFX ${s.sfx ? 'on' : 'off'}; music ${s.music ? 'on (write 3–4 candidates, the user picks)' : 'off'}; punch-ins ${s.punchIns ? 'allowed (max 2)' : 'off'}; topic assets ${s.topicAssets ? 'on' : 'off'}.`,
  ].join('\n');
}

/** Web pictures of named things need a card to show them in (logo-pop or custom-animation). */
function webImageLine(p: Project): string {
  const c = p.selection?.cards ?? [];
  if (!c.includes('logo-pop') && !c.includes('custom-animation')) return '';
  return 'When a sentence names a concrete thing the footage does not show (a product, device, object, place, app), show a real picture of it on that word: find it on the web, `rf fetch` it, `rf cutout` a photo on a background, and pop it in (video-core assets.md, "Images from the web").';
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
      project.references.length ? `Reference reels: ${project.references.join(' ')}. Download each with yt-dlp into analysis/refs/ and watch them densely (video-core look.md §5).` : '',
      'Do not write a plan yet. End with a short summary of what you found.',
    ].join('\n');
  } else if (stage === 'music') {
    body = [
      'Stage: music. The user wants other tracks: suggest 3–4 different tracks than analysis/music-candidates.json lists (video-core music.md), overwrite that file and keep its format.',
      'Do not write a plan.',
    ].join('\n');
  } else if (stage === 'plan') {
    body = [
      `Stage: plan. Write plan.json following the ${skill} skill.`,
      ctx.fresh
        ? 'The user changed the option cards (and maybe the reference reels): build a NEW plan from scratch with the new cards. Do not copy the previous plan.json or earlier versions. If a reference reel listed here is not in analysis/refs/ yet, download and study it first and rewrite analysis/style.md (analyse skill, reference reels).'
        : '',
      selectionLines(project),
      webImageLine(project),
      motion,
      project.references.length ? 'The user gave reference reels: read analysis/style.md first and rebuild their look and techniques beat for beat (it overrides the preset look defaults; only pacing follows the user preferences).' : '',
      project.transcriptChecked ? 'The user corrected the transcript: captions come word for word from analysis/transcript-trimmed.json (talking head) or analysis/transcript.json, never from transcript-review.json (that holds the uncorrected words).' : '',
      project.music?.file ? `Music: inputs/music/${project.music.file} ("${project.music.title}", ${project.music.license}). Align it with rf beats.` : '',
      'Write plan.post too: the caption for the Instagram/TikTok post in the video’s language (a first line that makes people stop, 2–4 short lines on what the video gives them, a call to action) and 5–10 relevant hashtags without #.',
      'Then run `rf validate plan.json` and fix every error, then `rf save plan.json --request "first cut"`.',
    ].join('\n');
  } else if (stage === 'rebuild') {
    const thread = (ctx.chat ?? []).map((m) => `${m.role === 'user' ? 'USER' : 'YOU'}: ${m.text}`).join('\n\n');
    body = [
      'Stage: rebuild. The user wants the whole video rebuilt from their feedback. The feedback chat so far, oldest first:',
      `"""\n${thread}\n"""`,
      'Act on the newest USER message; the earlier ones still hold unless the newest overrides them.',
      `Rebuild plan.json from scratch: rethink the structure, footage choices, cards, animations and timing so ALL of the feedback is met. Look at the current version (\`rf project\` → latest.plan, v${latest ?? '?'}) only to see what the user disliked; do not just patch it.`,
      selectionLines(project),
      webImageLine(project),
      motion,
      project.references.length ? 'Reference reels: read analysis/style.md and keep rebuilding their look and techniques beat for beat.' : '',
      project.transcriptChecked ? 'Captions come word for word from the corrected transcript (analysis/transcript-trimmed.json or analysis/transcript.json).' : '',
      project.music?.file ? `Music: inputs/music/${project.music.file}. Align it with rf beats.` : '',
      'Write plan.post too: the caption for the Instagram/TikTok post in the video’s language (a first line that makes people stop, 2–4 short lines on what the video gives them, a call to action) and 5–10 relevant hashtags without #.',
      `Then \`rf validate plan.json\`, fix every error, and \`rf save plan.json --parent ${latest ?? 1} --request "<one line on the rebuild>"\`.`,
      'Your reply goes into the chat: one short line per point of the feedback saying what you did for it (or why you could not). No headings. If the feedback states a lasting preference, end with a line "PREFERENCE: <text>".',
    ].join('\n');
  } else {
    body = [
      `Stage: revise. Apply this request to version v${latest ?? '?'}, verbatim from the user:`,
      `"""${ctx.request ?? ''}"""`,
      diffs.length ? `The user also edited the plan by hand since your last version; treat these as preferences:\n${JSON.stringify(diffs)}` : '',
      selectionLines(project),
      motion,
      `Run \`rf project\` and write its \`latest.plan\` to plan.json first (it includes the user's hand edits), edit it, \`rf validate\`, then \`rf save plan.json --parent ${latest ?? 1} --request "<one line on what changed>"\`.`,
      'If the request states a lasting preference, end your reply with a line "PREFERENCE: <text>".',
    ].join('\n');
  }
  return [head, preferenceLines(ctx.preferences), body, replyLine(project.lang)].filter(Boolean).join('\n\n');
}
