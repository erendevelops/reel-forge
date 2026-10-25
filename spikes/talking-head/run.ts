/**
 * Spike B: talking head against the quality bar (spec §4.1). Renderer: hyperframes-layered (Task 9 decision).
 *
 *   npx tsx spikes/talking-head/run.ts analyse   transcribe → planTrims → renderTrimmedTake → faceTrack → cropPath ×3
 *                                                → working clips + voice; writes analysis/words-out.json for plan authoring
 *   npx tsx spikes/talking-head/run.ts render    validatePlan → renderLayered 9:16 → qa (format, loudness, footage luma
 *                                                on the base track, 2 fps contact sheet)
 *   npx tsx spikes/talking-head/run.ts all       both
 *
 * Inputs (read-only): ../tbd-spike-media/trent-peek-zWcK4BUHzxE.mp4 (CC BY, see SOURCES.md).
 * Outputs: ../tbd-spike-media/spike-b/.
 */
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { transcribe, type Transcript } from '../../lib/media/transcribe';
import { planTrims, quietCuts, remapTimes, renderTrimmedTake } from '../../lib/talking/trim';
import { cropPath, faceTrack, facePosition } from '../../lib/talking/reframe';
import { prepareClip, prepareVoice } from '../../lib/media/prepare';
import { probe } from '../../lib/media/probe';
import { run } from '../../lib/media/run';
import { renderLayered } from '../../lib/render/layered';
import { expectsAudio, footageLumaRegion, qa, type QaExpect, type QaReport } from '../../lib/render/qa';
import { RATIO_SIZE } from '../../lib/compile';
import { validatePlan, type Plan, type Ratio } from '../../lib/plan';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const MEDIA = path.resolve(REPO, '..', 'tbd-spike-media');
const SRC = path.join(MEDIA, 'trent-peek-zWcK4BUHzxE.mp4');
const OUT = path.join(MEDIA, 'spike-b');
const AN = path.join(OUT, 'analysis');
const TAKE = path.join(OUT, 'take.mp4');

/** Excerpt: source 0–57 s; the greeting ("What's up, people?") is cut as a retake; the excerpt ends after "agreed to." (before the skit). */
const EXCERPT_END = 57;
const LAST_WORD_END = 56.6;
const RETAKES: [number, number][] = [[0, 1.4]];
const TRIM = { maxGap: 0.3, pad: 0.08 };

/** Analysis prepares all three ratios; rendering is 9:16 only for now (4:5 and 1:1 deferred, see RESULT.md). */
const RATIOS: Ratio[] = ['9:16', '4:5', '1:1'];
const RENDER_RATIOS: Ratio[] = ['9:16'];
const tag = (r: Ratio) => r.replace(':', 'x');
const assetsFor = (r: Ratio) => path.join(OUT, `assets-${tag(r)}`);


const r3 = (x: number) => Number(x.toFixed(3));
const readJson = async <T>(f: string): Promise<T> => JSON.parse(await fs.readFile(f, 'utf8')) as T;
const writeJson = (f: string, v: unknown) => fs.writeFile(f, JSON.stringify(v, null, 2));

// ---------------------------------------------------------------------------------------------- analyse

async function analyse(): Promise<void> {
  await fs.mkdir(AN, { recursive: true });
  // 1. transcribe the excerpt (English, medium); cached
  const wav = path.join(AN, 'excerpt-0-57.wav');
  if (!existsSync(wav)) await run('ffmpeg', ['-y', '-v', 'error', '-i', SRC, '-t', String(EXCERPT_END), '-vn', '-ac', '1', '-ar', '16000', wav]);
  const tFile = path.join(AN, 'excerpt-medium.json');
  if (!existsSync(tFile)) await writeJson(tFile, await transcribe(wav, { lang: 'en', model: 'medium' }));
  const full = await readJson<Transcript>(tFile);
  const t: Transcript = { ...full, words: full.words.filter((w) => w.end <= LAST_WORD_END) };

  // 2. trims → the trimmed take (hard video cuts, 30 ms audio crossfades); remap words with the snapped ranges
  const planned = planTrims(t, { ...TRIM, retakes: RETAKES });
  // whisper word edges are ~30–150 ms off the audio: move each cut to the quietest frame-grid point nearby
  const quiet = await quietCuts(SRC, planned, { fps: (await probe(SRC)).fps });
  const segs = await renderTrimmedTake(SRC, quiet, TAKE);
  const out = remapTimes(t, segs);
  const takeDur = (await probe(TAKE)).duration;
  await writeJson(path.join(AN, 'trims.json'), { opts: { ...TRIM, retakes: RETAKES }, planned, quiet, snapped: segs, takeDuration: takeDur });
  await writeJson(path.join(AN, 'words-out.json'), out);
  console.log(`trims: ${segs.length} ranges, take ${takeDur.toFixed(3)} s`);
  for (const s of segs) console.log(`  ${s.from.toFixed(3)} – ${s.to.toFixed(3)}`);

  // 3. face track of the trimmed take (take time) and one crop path per ratio
  const track = await faceTrack(TAKE, { fps: 10 });
  await writeJson(path.join(AN, 'face-track.json'), track);
  console.log(`face track: ${track.boxes.length} boxes, facePosition ${JSON.stringify(facePosition(track))}`);
  const voice = path.join(AN, 'voice.wav');
  await prepareVoice(TAKE, voice);
  for (const r of RATIOS) {
    const [w, h] = RATIO_SIZE[r];
    const crop = cropPath(track, { w: track.w, h: track.h }, r);
    await writeJson(path.join(AN, `crop-${tag(r)}.json`), crop);
    const dir = assetsFor(r);
    await fs.mkdir(dir, { recursive: true });
    await prepareClip(TAKE, path.join(dir, 'take.mp4'), { from: 0, duration: takeDur, width: w, height: h, fps: 60, crop });
    await fs.copyFile(voice, path.join(dir, 'voice.wav'));
    console.log(`  ${r}: crop ${crop[0].w}x${crop[0].h}, x ${Math.min(...crop.map((c) => c.x))}–${Math.max(...crop.map((c) => c.x))}`);
  }
}

// ---------------------------------------------------------------------------------------------- render

async function loadPlan(): Promise<Plan> {
  const v = validatePlan(await readJson(path.join(HERE, 'plan.json')));
  if (!v.ok) throw new Error(`plan invalid:\n${v.errors.join('\n')}`);
  return v.plan;
}

/** Luma refs only where the footage is shown full frame (full-face scenes): split/graphics scenes scale or hide it. */
function lumaRefs(plan: Plan, r: Ratio): NonNullable<QaExpect['lumaRefs']> {
  const src = path.join(assetsFor(r), 'take.mp4');
  const refs: NonNullable<QaExpect['lumaRefs']> = [];
  for (const sc of plan.scenes) {
    if ((sc.layout ?? 'full-face') !== 'full-face') continue;
    // skip the 0.4 s layout tween at a scene start
    for (const f of [0.3, 0.7]) {
      const outT = r3(sc.start + 0.45 + (sc.end - sc.start - 0.45) * f);
      for (const sh of sc.shots) if (outT >= sh.at && outT < sh.at + sh.to - sh.from) refs.push({ src, srcT: r3(outT - sh.at + sh.from), outT });
    }
  }
  return refs;
}

/**
 * Footage colour on the deliverable itself: full-face scenes above the captions, split scenes inside the face card
 * (`footageLumaRegion` maps the card area back into the source frame), clear of the 0.4 s layout tween.
 */
function deliverableLumaRefs(plan: Plan, r: Ratio): NonNullable<QaExpect['deliverableLumaRefs']> {
  const [w, h] = RATIO_SIZE[r];
  const src = path.join(assetsFor(r), 'take.mp4');
  const refs: NonNullable<QaExpect['deliverableLumaRefs']> = [];
  for (const sc of plan.scenes) {
    const layout = sc.layout ?? 'full-face';
    if (layout !== 'full-face' && layout !== 'split') continue;
    const { region, srcRegion } = footageLumaRegion(layout, w, h, sc.shots[0]?.aspect ?? w / h);
    for (const f of [0.3, 0.7]) {
      const outT = r3(sc.start + 0.45 + (sc.end - sc.start - 0.45) * f);
      for (const sh of sc.shots) {
        if (outT >= sh.at && outT < sh.at + sh.to - sh.from) refs.push({ src, srcT: r3(outT - sh.at + sh.from), outT, region, srcRegion });
      }
    }
  }
  return refs;
}

function summary(label: string, r: QaReport): void {
  console.log(`\n[${label}] QA ${r.pass ? 'PASS' : 'FAIL'}`);
  for (const c of r.checks) console.log(`  ${c.pass ? 'ok  ' : 'FAIL'} ${c.name}: ${c.detail}`);
}

async function renderAll(): Promise<void> {
  const plan = await loadPlan();
  const results: Record<string, unknown> = {};
  for (const r of RENDER_RATIOS) {
    const [w, h] = RATIO_SIZE[r];
    const out = path.join(OUT, `talking-${tag(r)}.mp4`);
    const t0 = performance.now();
    const { base } = await renderLayered(plan, { assetsDir: assetsFor(r), workDir: path.join(OUT, `work-${tag(r)}`), out, ratio: r });
    const seconds = r3((performance.now() - t0) / 1000);
    const report = await qa(out, {
      fps: plan.fps, frames: Math.round(plan.duration * plan.fps), duration: plan.duration, width: w, height: h,
      lufs: -14, lumaRefs: lumaRefs(plan, r), lumaFile: base, audio: expectsAudio(plan),
      deliverableLumaRefs: deliverableLumaRefs(plan, r),
    });
    summary(r, report);
    await writeJson(path.join(OUT, `talking-${tag(r)}.qa.json`), report);
    results[r] = { file: out, base, seconds, qa: report };
  }
  await writeJson(path.join(OUT, 'render-results.json'), results);
}

async function main(): Promise<void> {
  const cmd = process.argv[2] ?? 'all';
  await fs.mkdir(OUT, { recursive: true });
  if (cmd === 'analyse' || cmd === 'all') await analyse();
  if (cmd === 'render' || cmd === 'all') await renderAll();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
