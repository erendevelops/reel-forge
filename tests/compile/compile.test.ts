import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { run } from '../../lib/media/run';
import { makeClip } from '../helpers/media';
import { npx } from '../helpers/npx';
import { validatePlan, type Plan } from '../../lib/plan';
import { compile } from '../../lib/compile';
import { cardRegistry } from '../../lib/compile/cards';
import fixture from '../fixtures/plan-reel-v5.json';

let tmp: string;
let assetsDir: string;
let plan: Plan;
let html: string;
let outDir: string;

const r3 = (n: number) => String(Number(n.toFixed(3)));

/** Generates stand-ins for every file the fixture references (shots, voice, ext/ images). */
async function populateAssets(dir: string, p: Plan): Promise<void> {
  await fs.mkdir(path.join(dir, 'ext'), { recursive: true });
  const shots = new Map<string, number>();
  for (const s of p.scenes) for (const sh of s.shots) shots.set(sh.src, Math.max(shots.get(sh.src) ?? 0, sh.to));
  for (const [src, to] of shots) {
    const clip = await makeClip(dir, { w: 64, h: 112, fps: 60, seconds: Math.ceil(to + 0.5) });
    await fs.rename(clip, path.join(dir, src));
  }
  const imgs = new Set<string>();
  for (const s of p.scenes)
    for (const c of s.cards) {
      const pr = c.params as Record<string, unknown>;
      if (typeof pr.img === 'string') imgs.add(pr.img);
      if (typeof pr.logo === 'string') imgs.add(pr.logo);
      if (Array.isArray(pr.items)) for (const it of pr.items as { logo?: string }[]) if (it.logo) imgs.add(it.logo);
    }
  for (const img of imgs) {
    await run('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=0x3366cc:s=64x64', '-frames:v', '1', path.join(dir, img)]);
  }
  await run('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', `sine=frequency=220:sample_rate=48000:duration=${p.duration}`, path.join(dir, p.voice!.src)]);
}

beforeAll(async () => {
  const v = validatePlan(fixture);
  if (!v.ok) throw new Error(v.errors.join('\n'));
  plan = v.plan;
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'compile-'));
  assetsDir = path.join(tmp, 'media');
  await fs.mkdir(assetsDir);
  await populateAssets(assetsDir, plan);
  outDir = path.join(tmp, 'out');
  ({ indexHtml: html } = await compile(plan, { outDir, assetsDir, ratio: '9:16' }));
}, 240000);

afterAll(async () => {
  if (tmp) await fs.rm(tmp, { recursive: true, force: true });
});

function tags(src: string, name: string): string[] {
  return src.match(new RegExp(`<${name}\\b[^>]*>`, 'g')) ?? [];
}
function attr(tag: string, name: string): string | undefined {
  return tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
}
function timeline(src: string): string {
  const m = src.match(/<script>([\s\S]*?)<\/script>/g);
  return (m ?? []).join('\n');
}

describe('compile', () => {
  it('compile is deterministic', async () => {
    const again = await compile(plan, { outDir: path.join(tmp, 'out2'), assetsDir, ratio: '9:16' });
    expect(again.indexHtml).toBe(html);
    expect(await fs.readFile(path.join(outDir, 'index.html'), 'utf8')).toBe(html);
  });

  it('footage layer', () => {
    const videos = tags(html, 'video');
    expect(videos).toHaveLength(12);
    const shots = plan.scenes.flatMap((s) => s.shots);
    videos.forEach((v, i) => {
      const sh = shots[i];
      expect(v).toMatch(/\smuted[\s>]/);
      expect(attr(v, 'class')).toBe('clip');
      expect(attr(v, 'data-start')).toBe(r3(sh.at));
      expect(attr(v, 'data-duration')).toBe(r3(sh.to - sh.from));
      expect(attr(v, 'data-media-start')).toBe(r3(sh.from));
      expect(attr(v, 'src')).toBe(`assets/${sh.src}`);
    });
  });

  it('copies referenced assets and gsap', async () => {
    for (const f of ['s01.mp4', 'vo.wav', 'ext/openai.png', 'ext/fooocus.png', 'sfx/pluck_002.wav', 'gsap.min.js']) {
      await expect(fs.stat(path.join(outDir, 'assets', f))).resolves.toBeTruthy();
    }
    expect(html).toContain('<script src="assets/gsap.min.js"></script>');
    expect(html).toMatch(/@font-face\s*\{[^}]*font-family:\s*'Inter'[^}]*assets\/fonts\/inter-latin-ext-800-normal\.woff2/);
  });

  it('punch-in only on shots with punch', () => {
    const tl = timeline(html);
    const punches = tl.match(/scale: 1\.08/g) ?? [];
    expect(punches).toHaveLength(2);
    expect(tl).toMatch(/tl\.fromTo\("#shot-1", \{ scale: 1 \}, \{ scale: 1\.08, [^}]*\}, 2\.42\)/);
  });

  it('voice and sfx', () => {
    const audios = tags(html, 'audio');
    const voice = audios.filter((a) => attr(a, 'id') === 'voice');
    expect(voice).toHaveLength(1);
    expect(attr(voice[0], 'data-start')).toBe('0');
    expect(attr(voice[0], 'src')).toBe('assets/vo.wav');
    const sfx = audios.filter((a) => attr(a, 'id')?.startsWith('sfx-'));
    expect(sfx).toHaveLength(plan.sfx.length);
    sfx.forEach((a, i) => {
      expect(attr(a, 'class')).toBe('clip');
      expect(attr(a, 'data-start')).toBe(r3(plan.sfx[i].at));
      expect(attr(a, 'data-volume')).toBe(r3(plan.sfx[i].volume));
      expect(Number(attr(a, 'data-duration'))).toBeGreaterThan(0);
    });
  });

  it('root contract', () => {
    const root = tags(html, 'div').find((d) => attr(d, 'id') === 'root')!;
    expect(attr(root, 'data-composition-id')).toBe('main');
    expect(attr(root, 'data-width')).toBe('1080');
    expect(attr(root, 'data-height')).toBe('1920');
    expect(attr(root, 'data-fps')).toBe('60');
    expect(attr(root, 'data-duration')).toBe('32');
    const tl = timeline(html);
    expect(tl).toContain('gsap.timeline({ paused: true })');
    expect(tl).toContain('window.__timelines["main"] = tl;');
    expect(tl).not.toMatch(/tl\.from\(/);
    expect(html).not.toMatch(/Math\.random|Date\.now/);
  });

  it('captions word-build', () => {
    const tl = timeline(html);
    const g = plan.captions.groups[0];
    g.words.forEach(([word, t], i) => {
      const id = `#cap-1-w${i + 1}`;
      expect(html).toContain(`id="cap-1-w${i + 1}"`);
      expect(html).toContain(`>${word}</span>`);
      const fade = tl.split('\n').find((l) => l.startsWith(`tl.fromTo("${id}", { opacity: 0 }`))!;
      expect(fade).toBeDefined();
      expect(fade).toContain('duration: 0.08');
      expect(fade).not.toContain('scale');
      expect(fade.endsWith(`, ${r3(t)});`)).toBe(true);
      // newest word yellow at its time; previous word back to white at the same time
      expect(tl).toContain(`tl.set("${id}", { color: "#FFD21F" }, ${r3(t)});`);
      if (i > 0) expect(tl).toContain(`tl.set("#cap-1-w${i}", { color: "#FFFFFF" }, ${r3(t)});`);
    });
    // only one yellow set per word time in group 1
    const yellowAt0 = tl.split('\n').filter((l) => l.includes('#cap-1-') && l.includes('#FFD21F') && l.endsWith(', 0);'));
    expect(yellowAt0).toHaveLength(1);
  });

  it('cards render with reel values', () => {
    expect(html).toContain('Fooocus');
    expect(html).toMatch(/font-size: 100px[^"]*">Browser Use</); // > 9 chars
    expect(html).toMatch(/font-size: 118px[^"]*">Fooocus</);
    expect(html).toContain('6px solid #FFFFFF');
    const tl = timeline(html);
    // logo pop: scale 0 -> 1 with rotation from params
    expect(tl).toMatch(/tl\.fromTo\("#hook-logo-pop-1 \.lp-card", \{ scale: 0, rotation: 0 \}, \{ scale: 1, rotation: -5, [^}]*\}, 0\.68\)/);
    // title card in: scale 0.6 -> 1 with back.out
    expect(tl).toMatch(/tl\.fromTo\("#fooocus-title-card-1 \.tc-inner", \{ scale: 0\.6, opacity: 0 \}, \{ scale: 1, opacity: 1, [^}]*back\.out[^}]*\}, 6\.6\)/);
    // no gradients anywhere
    expect(html).not.toMatch(/gradient/);
  });

  it('numbered list: latest highlighted, none at CTA', () => {
    expect(html).toMatch(/id="voicestudio-numbered-list-1-i5"[^>]*color: #FFD21F/);
    expect(html).toMatch(/id="voicestudio-numbered-list-1-i4"[^>]*color: #FFFFFF/);
    expect(html).toMatch(/id="cta-numbered-list-1-i5"[^>]*color: #FFFFFF/);
    expect(html).toMatch(/left: 100px; top: 200px/);
  });

  it('numbered list slides in items that land after card start', () => {
    const card = { type: 'numbered-list' as const, start: 10, end: 14, params: {
      items: [{ n: 1, name: 'A', at: 8 }, { n: 2, name: 'B', at: 12 }], highlight: 'latest' } };
    const ctx = { width: 1080, height: 1920, fps: 60, ratio: '9:16' as const, assetsUrl: (p: string) => `assets/${p}` };
    const f = cardRegistry['numbered-list'].render(card, 'nl', ctx);
    expect(f.timeline).toContain('tl.fromTo("#nl-i2", { opacity: 0, x: -60 }, { opacity: 1, x: 0,');
    expect(f.timeline).toContain('tl.set("#nl-i2", { color: "#FFD21F" }, 12);');
    expect(f.timeline).toContain('tl.set("#nl-i1", { color: "#FFFFFF" }, 12);');
    expect(f.timeline).not.toContain('#nl-i1", { opacity: 0');
  });

  it('unimplemented card types throw', () => {
    const ctx = { width: 1080, height: 1920, fps: 60, ratio: '9:16' as const, assetsUrl: (p: string) => p };
    expect(() => cardRegistry['stamp'].render({ type: 'stamp', start: 0, end: 1, params: {} }, 'x', ctx)).toThrow('not implemented: stamp');
  });

  it('recomposes per ratio', async () => {
    const sq = await compile(plan, { outDir: path.join(tmp, 'out-sq'), assetsDir, ratio: '1:1' });
    const root = tags(sq.indexHtml, 'div').find((d) => attr(d, 'id') === 'root')!;
    expect(attr(root, 'data-width')).toBe('1080');
    expect(attr(root, 'data-height')).toBe('1080');
    expect(sq.indexHtml).toMatch(new RegExp(`#captions \\{[^}]*top: ${Math.round(0.677 * 1080)}px`));
    expect(html).toMatch(new RegExp(`#captions \\{[^}]*top: ${Math.round(0.677 * 1920)}px`));
  });

  it('applies scene ratioOverrides to card params', async () => {
    const p: Plan = structuredClone(plan);
    p.scenes[0].ratioOverrides = { '1:1': { top: 100 } };
    const sq = await compile(p, { outDir: path.join(tmp, 'out-ov'), assetsDir, ratio: '1:1' });
    // top 100 of a 1920 design -> fraction of 1080
    expect(sq.indexHtml).toMatch(new RegExp(`id="hook-logo-pop-1"[\\s\\S]*?top: ${r3((100 / 1920) * 1080)}px`));
  });

  it('overlayOnly omits footage', async () => {
    const ov = await compile(plan, { outDir: path.join(tmp, 'out-overlay'), assetsDir, ratio: '9:16', overlayOnly: true });
    expect(ov.indexHtml).not.toContain('<video');
    expect(tags(ov.indexHtml, 'audio').filter((a) => attr(a, 'id') === 'voice')).toHaveLength(0);
    expect(tags(ov.indexHtml, 'audio').filter((a) => attr(a, 'id')?.startsWith('sfx-'))).toHaveLength(plan.sfx.length);
    expect(ov.indexHtml).toContain('background: transparent');
    expect(ov.indexHtml).toContain('id="captions"');
    await expect(fs.stat(path.join(tmp, 'out-overlay', 'assets', 's01.mp4'))).rejects.toThrow();
  });

  it('hyperframes lint passes', async () => {
    const [cmd, args] = npx(['-y', 'hyperframes@0.8.191', 'lint', outDir]);
    const res = await run(cmd, args, { timeoutMs: 120000 });
    expect(res.code).toBe(0);
  }, 130000);
});
