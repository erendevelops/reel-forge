import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { RATIO_SIZE, compile } from '@/lib/compile';
import { npx } from '@/lib/media/npx';
import { probe } from '@/lib/media/probe';
import { prepareClip } from '@/lib/media/prepare';
import { run } from '@/lib/media/run';
import { transcribe, type Transcript } from '@/lib/media/transcribe';
import { graphicGaps, motionGaps, unusedCards, validatePlan, RATIOS, type Plan, type Ratio } from '@/lib/plan';
import { resolveLogo, logoSvgFile } from '@/lib/assets/logos';
import { cropPath, faceTrack, type FaceTrack } from '@/lib/talking/reframe';
import { planTrims, remapTimes, renderTrimmedTake, type Segment } from '@/lib/talking/trim';
import { repoPath } from '@/lib/root';
import { BUNDLED_ASSETS, resolveAsset } from '@/lib/media/assets';
import { readdirSync } from 'node:fs';
import { getPreferences, getProject, listVersions, readVersion, saveVersion, validateForProject } from '@/lib/app/workspace/store';
import { parseArgs, projectId, resolveInProject } from './context';
import { analysisState } from '@/lib/app/flow';
import { TranscriptSchema, syncCaptions } from '@/lib/app/transcript';

type Command = (args: string[]) => Promise<unknown>;

const FONT = process.platform === 'darwin' ? '/System/Library/Fonts/Supplemental/Arial.ttf' : 'C\\:/Windows/Fonts/arial.ttf';

const readJson = async (p: string) => JSON.parse(await readFile(resolveInProject(p), 'utf8'));

/**
 * What the user ticked must show up: faceless and app videos use every ticked card type at least once, and a
 * faceless reel never runs more than 5 s on footage alone (talking heads have their own motion rule). A ticked cover
 * needs `plan.cover` (every preset).
 */
function useErrors(project: { preset: string; selection: { cards: string[]; thumbnail: boolean } | null }, plan: Plan): string[] {
  if (!project.selection) return [];
  const cover = project.selection.thumbnail && !plan.cover ? ['the cover is ticked but plan.cover is missing: add { at, title } (video-core plan-contract.md)'] : [];
  if (project.preset === 'talking-head') return cover;
  const out = [...cover, ...unusedCards(plan, project.selection.cards).map((t) => `ticked card ${t} is never used: the user ticked it to see it, use it at least once where it fits the voiceover`)];
  if (project.preset === 'faceless') {
    for (const g of graphicGaps(plan)) out.push(`no card on screen ${g.from}–${g.to} s (over 5 s of footage only): add a card that shows what is being said`);
  }
  return out;
}

function need(v: string | undefined, what: string): string {
  if (!v) throw new Error(`missing ${what}`);
  return v;
}

function ratio(v: string | undefined): Ratio {
  if (!v || !(RATIOS as readonly string[]).includes(v)) throw new Error(`--ratio must be one of ${RATIOS.join(', ')}`);
  return v as Ratio;
}

async function python(args: string[]): Promise<void> {
  const env = { ...process.env, PYTHONIOENCODING: 'utf-8' };
  try {
    await run('python', args, { env });
  } catch (err) {
    if ((err as { code?: number }).code !== -1) throw err;
    await run('python3', args, { env });
  }
}

/**
 * The option cards are the user's, never the plan's: validation always uses the project's selection, so a plan that
 * edits its own `selection` to allow an unticked card is still refused.
 */
/** Sound files the plan names that neither the project inputs nor the bundled library have (the render would fail). */
function missingSfx(plan: unknown): string[] {
  const cues = (plan as { sfx?: { file?: unknown }[] })?.sfx ?? [];
  const errors: string[] = [];
  for (const c of cues) {
    if (typeof c?.file !== 'string') continue;
    try {
      resolveAsset(c.file, resolveInProject('inputs'));
    } catch {
      const base = path.posix.basename(c.file);
      const hit = sfxIndex().find((f) => path.posix.basename(f) === base);
      errors.push(`sfx: ${c.file} does not exist${hit ? ` (did you mean ${hit}?)` : ' (see the catalog in video-core/references/sfx.md)'}`);
    }
  }
  return [...new Set(errors)];
}

let sfxFiles: string[] | undefined;
function sfxIndex(): string[] {
  return (sfxFiles ??= (readdirSync(path.join(BUNDLED_ASSETS, 'sfx'), { recursive: true }) as string[]).map((f) => `sfx/${f.split(path.sep).join('/')}`));
}

export const COMMANDS: Record<string, Command> = {
  async project() {
    const id = projectId();
    const versions = await listVersions(id);
    const n = versions.at(-1)?.n;
    // A revision starts from this plan (it includes the user's hand edits), never from an old plan.json.
    const latest = n ? { n, plan: (await readVersion(id, n)).plan } : null;
    return { project: await getProject(id), preferences: await getPreferences(), versions, latest };
  },

  async probe(args) {
    return probe(resolveInProject(need(args[0], 'file')));
  },

  async sheet(args) {
    const { pos, flags } = parseArgs(args);
    const [src, out] = [resolveInProject(need(pos[0], 'video')), resolveInProject(need(pos[1], 'out.jpg'))];
    const every = Number(flags.every ?? 2);
    const { duration } = await probe(src);
    // --from/--to: a dense look at one stretch (e.g. a reference reel in 10 s chunks at --every 0.5)
    const from = Math.max(0, Number(flags.from ?? 0));
    const to = Math.min(duration, Number(flags.to ?? duration));
    const n = Math.max(1, Math.ceil((to - from) / every));
    const cols = Math.min(10, n);
    await mkdir(path.dirname(out), { recursive: true });
    await run('ffmpeg', [
      '-y', '-v', 'error', '-ss', String(from), '-t', String(Math.max(0.1, to - from)), '-i', src, '-an', '-vf',
      `fps=1/${every},scale=216:-1,drawtext=fontfile='${FONT}':text='%{pts\\:hms\\:${from}}':x=4:y=4:fontsize=16:fontcolor=yellow:box=1:boxcolor=black,tile=${cols}x${Math.ceil(n / cols)}`,
      '-frames:v', '1', out,
    ]);
    return { out: path.relative(resolveInProject('.'), out) };
  },

  async cuts(args) {
    const src = resolveInProject(need(args[0], 'video'));
    const r = await run('ffmpeg', ['-v', 'info', '-i', src, '-vf', "select='gt(scene,0.3)',showinfo", '-f', 'null', '-']);
    return { cuts: [...r.stderr.matchAll(/pts_time:([\d.]+)/g)].map((m) => Number(m[1])) };
  },

  async transcribe(args) {
    const { pos, flags } = parseArgs(args);
    return transcribe(resolveInProject(need(pos[0], 'audio')), { lang: flags.lang ?? 'auto', prompt: flags.prompt });
  },

  async prep(args) {
    const { pos, flags } = parseArgs(args);
    const [w, h] = RATIO_SIZE[ratio(flags.ratio)];
    const out = resolveInProject(need(pos[1], 'out'));
    await mkdir(path.dirname(out), { recursive: true });
    await prepareClip(resolveInProject(need(pos[0], 'src')), out, {
      from: Number(need(flags.from, '--from')),
      duration: Number(need(flags.duration, '--duration')),
      width: w,
      height: h,
      fps: flags.fps === '30' ? 30 : 60,
      crop: flags.crop ? (await readJson(flags.crop)).path : undefined,
    });
    return { out: pos[1] };
  },

  async trims(args) {
    const { pos, flags } = parseArgs(args);
    const t = (await readJson(need(pos[0], 'transcript.json'))) as Transcript;
    return { segments: planTrims(t, flags['max-gap'] ? { maxGap: Number(flags['max-gap']) } : {}) };
  },

  /**
   * The talking-head take with dead air cut: renders the kept segments (frame-snapped, crossfaded audio joins) and
   * writes the transcript re-timed onto the trimmed take, so shots and captions both use trimmed time.
   */
  async trimtake(args) {
    const { pos, flags } = parseArgs(args);
    const src = resolveInProject(need(pos[0], 'take'));
    const { segments } = (await readJson(need(pos[1], 'trims.json'))) as { segments: Segment[] };
    const out = resolveInProject(need(pos[2], 'out.mp4'));
    await mkdir(path.dirname(out), { recursive: true });
    const snapped = await renderTrimmedTake(src, segments, out);
    let transcript: string | undefined;
    if (flags.transcript) {
      const t = (await readJson(flags.transcript)) as Transcript;
      transcript = path.join('analysis', 'transcript-trimmed.json');
      await mkdir(resolveInProject('analysis'), { recursive: true });
      await writeFile(resolveInProject(transcript), JSON.stringify(remapTimes(t, snapped)));
    }
    return { out: pos[2], segments: snapped, duration: (await probe(out)).duration, transcript: transcript?.split(path.sep).join('/') };
  },

  async facetrack(args) {
    const [src, out] = [resolveInProject(need(args[0], 'video')), resolveInProject(need(args[1], 'out.json'))];
    const track = await faceTrack(src);
    await mkdir(path.dirname(out), { recursive: true });
    await writeFile(out, JSON.stringify(track));
    return { out: args[1], samples: track.boxes.length, detected: track.boxes.length };
  },

  async crop(args) {
    const { pos, flags } = parseArgs(args);
    const track = (await readJson(need(pos[0], 'track.json'))) as FaceTrack;
    return { path: cropPath(track, { w: track.w, h: track.h }, ratio(flags.ratio)) };
  },

  async logo(args) {
    const logo = resolveLogo(args.join(' '));
    if (!logo) return { found: false };
    const file = path.join('assets', 'si', `${logo.slug}.svg`);
    const full = resolveInProject(file);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, logoSvgFile(logo));
    return { found: true, slug: logo.slug, title: logo.title, hex: logo.hex, file: file.split(path.sep).join('/') };
  },

  async beats(args) {
    const src = resolveInProject(need(args[0], 'audio'));
    const out = resolveInProject(path.join('analysis', `beats-${path.basename(src)}.json`));
    await mkdir(path.dirname(out), { recursive: true });
    await python([repoPath('tools', 'beats.py'), src, out]);
    return JSON.parse(await readFile(out, 'utf8'));
  },

  async validate(args) {
    const plan = await readJson(need(args[0], 'plan.json'));
    const r = await validateForProject(projectId(), plan);
    const errors = [...(r.ok ? useErrors(await getProject(projectId()), r.plan) : r.errors), ...missingSfx(plan)];
    return errors.length ? { ok: false, errors } : { ok: true, errors: [] };
  },

  /**
   * Stills of the plan at given times (`--at 3,8.5`), so Claude sees its scenes before saving: compiles the page
   * into `.preview/<ratio>/` and snapshots it with HyperFrames (no video render, no vision upload). Returns the PNGs
   * and a contact sheet.
   */
  async preview(args) {
    const { pos, flags } = parseArgs(args);
    const plan = await readJson(need(pos[0], 'plan.json'));
    const r = await validateForProject(projectId(), plan);
    if (!r.ok) throw new Error(`invalid plan:\n${r.errors.join('\n')}`);
    const ratio = (flags.ratio ?? r.plan.ratios[0]) as Ratio;
    if (!RATIOS.includes(ratio)) throw new Error(`--ratio must be one of ${RATIOS.join(', ')}`);
    const at = String(need(flags.at, '--at <s,s,…>')).split(',').map(Number).filter((t) => Number.isFinite(t) && t >= 0 && t <= r.plan.duration);
    if (!at.length) throw new Error(`--at needs times within 0–${r.plan.duration}`);
    const dir = resolveInProject(path.join('.preview', ratio.replace(':', 'x')));
    const out = resolveInProject(path.join('analysis', 'preview'));
    await compile(r.plan, { outDir: dir, assetsDir: resolveInProject('inputs'), ratio });
    const [cmd, a] = npx(['-y', 'hyperframes@0.8.191', 'snapshot', dir, '--at', at.join(','), '--no-end', '--describe', 'false', '-o', out]);
    await run(cmd, a, { timeoutMs: 10 * 60 * 1000 });
    const files = (readdirSync(out) as string[]).filter((f) => /\.(png|jpe?g)$/i.test(f)).map((f) => path.posix.join('analysis/preview', f));
    return { stills: files };
  },

  async gaps(args) {
    const r = validatePlan(await readJson(need(args[0], 'plan.json')));
    if (!r.ok) throw new Error(r.errors.join('\n'));
    return { gaps: motionGaps(r.plan) };
  },

  async save(args) {
    const { pos, flags } = parseArgs(args);
    const plan = await readJson(need(pos[0], 'plan.json'));
    const id = projectId();
    const project = await getProject(id);
    const r = await validateForProject(projectId(), plan);
    const errors = [...(r.ok ? useErrors(project, r.plan) : r.errors), ...missingSfx(plan)];
    if (!r.ok || errors.length) throw new Error(`invalid plan:\n${errors.join('\n')}`);
    if (project.preset === 'talking-head') {
      const gaps = motionGaps(r.plan);
      if (gaps.length) {
        throw new Error(`static for more than 3 s at: ${gaps.map((g) => `${g.from}–${g.to}`).join(', ')}. Add a visual change in each.`);
      }
    }
    // captions always carry the user's corrections, whichever transcript file the plan was written from
    let captionsFixed = 0;
    if (project.transcriptChecked) {
      const { transcriptFile } = await analysisState(id);
      if (transcriptFile) {
        const synced = syncCaptions(r.plan, TranscriptSchema.parse(await readJson(transcriptFile)));
        r.plan = synced.plan;
        captionsFixed = synced.fixed;
      }
    }
    const version = await saveVersion(id, {
      plan: r.plan,
      by: 'claude',
      parent: flags.parent ? Number(flags.parent) : null,
      request: flags.request ?? null,
    });
    return captionsFixed ? { version, captionsFixed } : { version };
  },
};
