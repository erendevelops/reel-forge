import { describe, it, expect, afterAll } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { resolveLogo, logoRef } from '../../lib/assets/logos';
import { validatePlan } from '../../lib/plan';
import { compile } from '../../lib/compile';

const dirs: string[] = [];
afterAll(async () => {
  for (const d of dirs) await fs.rm(d, { recursive: true, force: true });
});

describe('resolveLogo (offline, simple-icons)', () => {
  it('matches title and slug ignoring case, spaces and punctuation', () => {
    for (const q of ['GitHub', 'github', ' Git-Hub ', 'git hub!']) expect(resolveLogo(q)?.title, q).toBe('GitHub');
    expect(resolveLogo('Claude Code')?.title).toBe('Claude Code');
    expect(resolveLogo('claudecode')?.title).toBe('Claude Code');
    expect(resolveLogo('Node.js')?.title).toBe('Node.js');
  });

  it('resolves aliases: "claude" is Claude, "anthropic" is Anthropic', () => {
    expect(resolveLogo('claude')?.title).toBe('Claude');
    expect(resolveLogo('Anthropic')?.title).toBe('Anthropic');
  });

  it('returns svg, hex and title', () => {
    const l = resolveLogo('Claude')!;
    expect(l.svg).toMatch(/^<svg[^>]*viewBox="0 0 24 24"/);
    expect(l.hex).toMatch(/^[0-9A-F]{6}$/);
  });

  it('ChatGPT/GPT/OpenAI resolve to OpenAI via the simple-icons 13.0.0 fallback (removed from v16)', () => {
    for (const q of ['ChatGPT', 'chat gpt', 'GPT', 'OpenAI', 'openai']) {
      const l = resolveLogo(q);
      expect(l?.title, q).toBe('OpenAI');
      expect(l?.slug).toBe('openai');
    }
    expect(resolveLogo('ChatGPT')!.svg).toMatch(/^<svg[^>]*viewBox="0 0 24 24"/);
    // the current set still wins where it has the mark
    expect(resolveLogo('Claude')?.hex).toBe('D97757');
  });

  it('unknown returns null', () => {
    expect(resolveLogo('definitely not a brand 123')).toBeNull();
    expect(resolveLogo('')).toBeNull();
  });

  it('logoRef parses the si: reference form', () => {
    expect(logoRef('si:github')).toBe('github');
    expect(logoRef('ext/logo.png')).toBeUndefined();
  });
});

describe('si: references compile to asset files', () => {
  it('materialises the SVG into the project for title-card, numbered-list and logo-pop', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'logos-'));
    dirs.push(tmp);
    const v = validatePlan({
      version: 1, mode: 'reel', fps: 30, duration: 3, ratios: ['9:16'],
      selection: { captions: 'none', layouts: ['full-graphics'], cards: ['title-card', 'numbered-list', 'logo-pop'], sfx: false, music: false, punchIns: false, thumbnail: false, topicAssets: true },
      scenes: [{
        id: 's', start: 0, end: 3, say: 'x', why: 'x', layout: 'full-graphics', shots: [],
        cards: [
          { type: 'title-card', start: 0, end: 1, params: { n: 1, name: 'GitHub', logo: 'si:github' } },
          { type: 'numbered-list', start: 0, end: 3, params: { items: [{ n: 1, name: 'Claude', logo: 'si:claude', at: 0.5 }] } },
          { type: 'logo-pop', start: 1, end: 2, params: { img: 'si:claude', left: 100, top: 100 } },
          { type: 'logo-pop', start: 2, end: 3, params: { img: 'si:openai', left: 100, top: 100 } },
        ],
      }],
      captions: { style: 'none', groups: [] }, sfx: [],
    });
    if (!v.ok) throw new Error(v.errors.join('\n'));
    const out = path.join(tmp, 'out');
    const { indexHtml } = await compile(v.plan, { outDir: out, assetsDir: path.join(tmp, 'none'), ratio: '9:16' });
    expect(indexHtml).toContain('src="assets/si/github.svg"');
    expect(indexHtml).toContain('src="assets/si/claude.svg"');
    const gh = await fs.readFile(path.join(out, 'assets', 'si', 'github.svg'), 'utf8');
    expect(gh).toMatch(/^<svg[^>]*fill="#FFFFFF"/); // near-black brand colour: white on the dark tile
    const cl = await fs.readFile(path.join(out, 'assets', 'si', 'claude.svg'), 'utf8');
    expect(cl).toMatch(/^<svg[^>]*fill="#D97757"/);
    expect(indexHtml).toContain('src="assets/si/openai.svg"');
    const oa = await fs.readFile(path.join(out, 'assets', 'si', 'openai.svg'), 'utf8');
    // brand #412991 is too dark for the dark tile (luminance < 0.05): the mark is white, as OpenAI's own dark variant
    expect(oa).toMatch(/^<svg[^>]*fill="#FFFFFF"[^>]*><title>OpenAI<\/title>/);
    // deterministic
    const again = await compile(v.plan, { outDir: path.join(tmp, 'out2'), assetsDir: path.join(tmp, 'none'), ratio: '9:16' });
    expect(again.indexHtml).toBe(indexHtml);
  });
});
