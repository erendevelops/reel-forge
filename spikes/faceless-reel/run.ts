/**
 * Spike A: faceless reel colour test.
 *
 *   npx tsx spikes/faceless-reel/run.ts            single-path render; layered too if a luma check fails
 *   npx tsx spikes/faceless-reel/run.ts --layered  also run the layered path regardless
 *   npx tsx spikes/faceless-reel/run.ts --footage-only  diagnostic: luma of footage with no overlays (see footageOnly)
 *
 * Inputs (read-only): ../video/reel/public (v5 working clips s01–s12, vo.wav, ext/, sfx/).
 * Outputs: ../tbd-spike-media/spike-a/ (renders, qa.json, contact sheets, side-by-side PNGs, results.json).
 * If ../tbd-spike-media/v5-reference.mp4 exists, it is QA'd too and compared side by side with our render.
 */
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from '../../lib/compile';
import { render } from '../../lib/render/render';
import { qa, type QaExpect, type QaReport } from '../../lib/render/qa';
import { renderLayered } from '../../lib/render/layered';
import { finishLoudness } from '../../lib/media/prepare';
import { run } from '../../lib/media/run';
import { validatePlan, type Plan } from '../../lib/plan';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const ASSETS = path.resolve(REPO, '..', 'video', 'reel', 'public');
const MEDIA = path.resolve(REPO, '..', 'tbd-spike-media');
const OUT = path.join(MEDIA, 'spike-a');
const REFERENCE = path.join(MEDIA, 'v5-reference.mp4');

/** Comparison timestamps vs v5: hook cards, a title card, the list, the CTA. */
const COMPARE = [
  { name: 'hook-cards', t: 2.9 },
  { name: 'title-card', t: 7.1 },
  { name: 'list', t: 21.5 },
  { name: 'cta', t: 30.5 },
];

const r3 = (x: number) => Number(x.toFixed(3));

/** One luma ref per shot at its timeline midpoint: source t = midpoint − at + from. */
function lumaRefs(plan: Plan): NonNullable<QaExpect['lumaRefs']> {
  return plan.scenes.flatMap((s) => s.shots).map((sh) => {
    const mid = sh.at + (sh.to - sh.from) / 2;
    return { src: path.join(ASSETS, sh.src), srcT: r3(mid - sh.at + sh.from), outT: r3(mid) };
  });
}

function expectFor(plan: Plan): QaExpect {
  return {
    fps: plan.fps, frames: Math.round(plan.duration * plan.fps), duration: plan.duration,
    width: 1080, height: 1920, lufs: -14, lumaRefs: lumaRefs(plan),
  };
}

/** Full-resolution `hstack` of frame `ta` of `a` (left) and frame `tb` of `b` (right). */
async function sideBySide(a: string, ta: number, b: string, tb: number, out: string): Promise<void> {
  await run('ffmpeg', [
    '-y', '-v', 'error', '-ss', String(ta), '-i', a, '-ss', String(tb), '-i', b,
    '-filter_complex', '[0:v]scale=1080:1920[l];[1:v]scale=1080:1920[r];[l][r]hstack=inputs=2',
    '-frames:v', '1', out,
  ]);
}

async function timed<T>(f: () => Promise<T>): Promise<[T, number]> {
  const t0 = performance.now();
  const v = await f();
  return [v, r3((performance.now() - t0) / 1000)];
}

function summary(label: string, r: QaReport): void {
  console.log(`\n[${label}] QA ${r.pass ? 'PASS' : 'FAIL'}`);
  for (const c of r.checks) console.log(`  ${c.pass ? 'ok  ' : 'FAIL'} ${c.name}: ${c.detail}`);
}

/**
 * Diagnostic (--footage-only): the luma gate compares whole frames, so cards/captions over a shot move yavg
 * (v5 itself fails it). This renders the same plan with no cards and no captions on the single path and
 * measures the 12 refs against it, plus the layered path's footage-only base track if it exists.
 */
async function footageOnly(plan: Plan, expect: QaExpect): Promise<void> {
  const bare: Plan = { ...plan, sfx: [], scenes: plan.scenes.map((s) => ({ ...s, cards: [] })), captions: { ...plan.captions, groups: [] } };
  const proj = path.join(OUT, 'footage-proj');
  const out = path.join(OUT, 'footage-only.mp4');
  await compile(bare, { outDir: proj, assetsDir: ASSETS, ratio: '9:16' });
  const [, renderS] = await timed(() => render(proj, out, { fps: plan.fps }));
  const { lufs: _l, ...noLoud } = expect;
  const singleQa = await qa(out, noLoud);
  summary('footage-only single', singleQa);
  const res: Record<string, unknown> = { file: out, renderS, single: singleQa };
  const base = path.join(OUT, 'layered-work', 'base.mkv');
  if (existsSync(base)) {
    // base.mkv has no audio stream and is ffv1; only the luma check is meaningful here
    const lumaOnly = await qa(base, noLoud);
    const luma = lumaOnly.checks.find((c) => c.name === 'luma')!;
    console.log(`  layered base.mkv luma ${luma.pass ? 'ok' : 'FAIL'}: ${luma.detail}`);
    res.layeredBaseLuma = luma;
  }
  await fs.writeFile(path.join(OUT, 'footage-only.json'), JSON.stringify(res, null, 2));
}

async function main(): Promise<void> {
  const raw = JSON.parse(await fs.readFile(path.join(HERE, 'plan.json'), 'utf8'));
  const v = validatePlan(raw);
  if (!v.ok) throw new Error(`plan invalid:\n${v.errors.join('\n')}`);
  const plan = v.plan;
  await fs.mkdir(OUT, { recursive: true });
  const expect = expectFor(plan);
  if (process.argv.includes('--footage-only')) return footageOnly(plan, expect);
  const results: Record<string, unknown> = { plan: path.join(HERE, 'plan.json'), assets: ASSETS };

  // --- single path: compile -> HyperFrames render (60 fps, PNG frames) -> loudness finish -> QA
  const proj = path.join(OUT, 'single-proj');
  const singleRaw = path.join(OUT, 'single-raw.mp4');
  const single = path.join(OUT, 'single.mp4');
  const [, compileS] = await timed(() => compile(plan, { outDir: proj, assetsDir: ASSETS, ratio: '9:16' }));
  const [, renderS] = await timed(() => render(proj, singleRaw, { fps: plan.fps }));
  const [, finishS] = await timed(() => finishLoudness(singleRaw, single, { I: -14, TP: -1.5 }));
  const singleQa = await qa(single, expect);
  await fs.writeFile(path.join(OUT, 'single.qa.json'), JSON.stringify(singleQa, null, 2));
  summary('single', singleQa);
  results.single = { file: single, seconds: { compile: compileS, render: renderS, finish: finishS }, qa: singleQa };

  // shot 6 raw vs render (left = working clip s06, right = our render)
  const s6 = expect.lumaRefs![5];
  const s6png = path.join(OUT, 'shot06-raw-vs-single.png');
  await sideBySide(s6.src, s6.srcT, single, s6.outT, s6png);
  results.shot6 = { png: s6png, srcT: s6.srcT, outT: s6.outT };

  // --- layered path, if any luma check failed (or on request)
  const lumaFailed = singleQa.checks.some((c) => c.name === 'luma' && !c.pass);
  if (lumaFailed || process.argv.includes('--layered')) {
    const layered = path.join(OUT, 'layered.mp4');
    const [, layeredS] = await timed(() =>
      renderLayered(plan, { assetsDir: ASSETS, workDir: path.join(OUT, 'layered-work'), out: layered, ratio: '9:16' }));
    const layeredQa = await qa(layered, expect);
    await fs.writeFile(path.join(OUT, 'layered.qa.json'), JSON.stringify(layeredQa, null, 2));
    summary('layered', layeredQa);
    const png = path.join(OUT, 'shot06-raw-vs-layered.png');
    await sideBySide(s6.src, s6.srcT, layered, s6.outT, png);
    results.layered = { file: layered, seconds: layeredS, qa: layeredQa, shot6: png, triggeredBy: lumaFailed ? 'luma fail' : '--layered' };
  }

  // --- v5 reference (Remotion render of the original composition): same QA + side-by-side with ours
  if (existsSync(REFERENCE)) {
    const refQa = await qa(REFERENCE, expect);
    await fs.writeFile(path.join(OUT, 'v5-reference.qa.json'), JSON.stringify(refQa, null, 2));
    summary('v5-reference', refQa);
    const sheet = refQa.checks.find((c) => c.name === 'contactSheet')!.detail;
    const sheetCopy = path.join(OUT, 'v5-reference.sheet.jpg');
    await fs.copyFile(sheet, sheetCopy);
    const pngs: string[] = [];
    for (const c of COMPARE) {
      const png = path.join(OUT, `compare-${c.name}-${c.t}s-single-vs-v5.png`);
      await sideBySide(single, c.t, REFERENCE, c.t, png);
      pngs.push(png);
    }
    results.reference = { file: REFERENCE, qa: refQa, sheet: sheetCopy, compare: pngs, note: 'left = ours (single), right = v5 Remotion' };
  } else {
    console.log(`\n(no ${REFERENCE}; skipping the v5 comparison)`);
  }

  await fs.writeFile(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2));
  console.log(`\nresults: ${path.join(OUT, 'results.json')}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
