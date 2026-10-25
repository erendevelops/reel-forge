import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import type { Card, CardType, Plan, Ratio } from '../plan';
import { cardRegistry } from './cards';
import { renderCaptions } from './captions';
import { audioDuration, layoutRegion, renderFootage, renderMusic, renderSfx, renderVoice } from './layers';
import { type CompileContext, type Fragment, type Region, RATIO_SIZE, num } from './types';

export * from './types';
export { cardRegistry } from './cards';

export type CompileOptions = { outDir: string; assetsDir: string; ratio: Ratio; overlayOnly?: boolean };

/** Bundled assets (CC0 SFX) live in the repo's `assets/`; a plan's `sfx/...` resolves there if `assetsDir` lacks it. */
const BUNDLED_ASSETS = fileURLToPath(new URL('../../assets/', import.meta.url));
const require = createRequire(import.meta.url);

const FONTS: { pkg: string; weights: number[] }[] = [
  { pkg: '@fontsource/inter', weights: [600, 800, 900] },
  { pkg: '@fontsource/nunito', weights: [600, 800, 900] },
];
const FONT_SUBSETS = ['latin-ext', 'latin'];

/** Paint order (reel doc §7.2): shots < pop cards < title cards < list < captions. */
const CARD_LAYER: Partial<Record<CardType, number>> = { 'logo-pop': 0, 'title-card': 1, 'numbered-list': 2 };

function normAsset(p: string): string {
  const n = path.posix.normalize(p.replace(/\\/g, '/'));
  if (path.posix.isAbsolute(n) || /^[a-zA-Z]:/.test(n) || n === '..' || n.startsWith('../')) {
    throw new Error(`asset path must be relative to assetsDir: ${p}`);
  }
  return n;
}

function resolveAsset(rel: string, assetsDir: string): string {
  for (const base of [assetsDir, BUNDLED_ASSETS]) {
    const f = path.join(base, ...rel.split('/'));
    if (existsSync(f)) return f;
  }
  throw new Error(`missing asset: ${rel} (looked in ${assetsDir} and ${BUNDLED_ASSETS})`);
}

async function copyFile(src: string, dest: string): Promise<void> {
  await fs.mkdir(path.dirname(dest), { recursive: true });
  try {
    const [a, b] = await Promise.all([fs.stat(src), fs.stat(dest)]);
    if (a.size === b.size && b.mtimeMs >= a.mtimeMs) return; // already copied
  } catch {
    /* dest missing */
  }
  await fs.copyFile(src, dest);
}

function slug(s: string): string {
  const v = s.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
  return /^[a-z]/.test(v) ? v : `s-${v}`;
}

/** Copies the woff2 files and returns `@font-face` rules pointing at `assets/fonts/`. */
async function fonts(outDir: string): Promise<string> {
  const rules: string[] = [];
  for (const { pkg, weights } of FONTS) {
    const pkgDir = path.dirname(require.resolve(`${pkg}/package.json`));
    for (const w of weights) {
      const css = await fs.readFile(path.join(pkgDir, `${w}.css`), 'utf8');
      for (const subset of FONT_SUBSETS) {
        const name = `${path.basename(pkg)}-${subset}-${w}-normal`;
        const block = css.match(new RegExp(`/\\* ${name} \\*/\\s*@font-face \\{([^}]*)\\}`));
        if (!block) throw new Error(`font block ${name} not found in ${pkg}/${w}.css`);
        const family = block[1].match(/font-family:\s*([^;]+);/)![1].trim();
        const range = block[1].match(/unicode-range:\s*([^;]+);/)![1].trim();
        await copyFile(path.join(pkgDir, 'files', `${name}.woff2`), path.join(outDir, 'assets', 'fonts', `${name}.woff2`));
        rules.push(
          `@font-face { font-family: ${family}; font-style: normal; font-display: block; font-weight: ${w}; src: url(assets/fonts/${name}.woff2) format('woff2'); unicode-range: ${range}; }`,
        );
      }
    }
  }
  return rules.join('\n');
}

/** Compiles a plan into a HyperFrames project at `outDir` (index.html + assets/). Deterministic. */
export async function compile(plan: Plan, o: CompileOptions): Promise<{ indexHtml: string }> {
  const [width, height] = RATIO_SIZE[o.ratio];
  const used = new Set<string>();
  const ctx: CompileContext = {
    width,
    height,
    fps: plan.fps,
    ratio: o.ratio,
    assetsUrl: (p) => {
      const rel = normAsset(p);
      used.add(rel);
      return `assets/${rel.split('/').map(encodeURIComponent).join('/')}`;
    },
  };

  const frags: Fragment[] = [];
  if (!o.overlayOnly) frags.push(renderFootage(plan, ctx));

  // cards: stable layer order, then plan order
  const cards: { card: Card; id: string; layer: number; seq: number; region: Region }[] = [];
  const sceneSlugs = new Set<string>();
  plan.scenes.forEach((scene, si) => {
    let s = slug(scene.id);
    if (sceneSlugs.has(s)) s = `${s}-${si + 1}`;
    sceneSlugs.add(s);
    const perType = new Map<CardType, number>();
    const overrides = scene.ratioOverrides?.[o.ratio] ?? {};
    for (const card of scene.cards) {
      const k = (perType.get(card.type) ?? 0) + 1;
      perType.set(card.type, k);
      cards.push({
        card: { ...card, params: { ...card.params, ...overrides } },
        id: `${s}-${card.type}-${k}`,
        layer: CARD_LAYER[card.type] ?? 1,
        seq: cards.length,
        region: layoutRegion(scene.layout, ctx),
      });
    }
  });
  cards.sort((a, b) => a.layer - b.layer || a.seq - b.seq);
  for (const c of cards) frags.push(cardRegistry[c.card.type].render(c.card, c.id, { ...ctx, region: c.region }));
  frags.push(renderCaptions(plan.captions, ctx));

  const sfxDur = await Promise.all(plan.sfx.map((c) => audioDuration(resolveAsset(normAsset(c.file), o.assetsDir))));
  const audio = [
    o.overlayOnly ? '' : renderVoice(plan, ctx),
    o.overlayOnly ? '' : renderMusic(plan, ctx),
    renderSfx(plan, ctx, sfxDur),
  ].filter(Boolean);

  // copy assets
  for (const rel of [...used].sort()) {
    await copyFile(resolveAsset(rel, o.assetsDir), path.join(o.outDir, 'assets', ...rel.split('/')));
  }
  await copyFile(require.resolve('gsap/dist/gsap.min.js'), path.join(o.outDir, 'assets', 'gsap.min.js'));
  const fontCss = await fonts(o.outDir);

  const bg = o.overlayOnly ? 'transparent' : '#000000';
  const css: string[] = [];
  for (const f of frags) for (const rule of f.css.split('\n')) if (rule && !css.includes(rule)) css.push(rule);
  const timeline = frags.map((f) => f.timeline).filter(Boolean).join('\n');

  const indexHtml = `<!doctype html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=${width}, height=${height}">
<script src="assets/gsap.min.js"></script>
<style>
${fontCss}
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: ${width}px; height: ${height}px; overflow: hidden; background: ${bg}; }
#root { position: relative; width: ${width}px; height: ${height}px; overflow: hidden; background: ${bg}; font-family: 'Inter', sans-serif; }
${css.join('\n')}
</style>
</head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="${num(plan.duration)}" data-width="${width}" data-height="${height}" data-fps="${plan.fps}">
${frags.map((f) => f.html).filter(Boolean).join('\n')}
${audio.join('\n')}
</div>
<script>
window.__timelines = window.__timelines || {};
const tl = gsap.timeline({ paused: true });
${timeline}
window.__timelines["main"] = tl;
</script>
</body>
</html>
`;

  await fs.mkdir(o.outDir, { recursive: true });
  await fs.writeFile(path.join(o.outDir, 'index.html'), indexHtml, 'utf8');
  return { indexHtml };
}
