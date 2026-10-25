import { createRequire } from 'node:module';
import * as icons from 'simple-icons';

/** An offline brand mark from the bundled `simple-icons` set: a 24×24 single-path SVG and the brand colour. */
export type Logo = { svg: string; hex: string; title: string; slug: string };

type SiIcon = { title: string; slug: string; hex: string; svg: string; path: string };
type SiData = { title: string; slug: string; aliases?: { aka?: string[]; dup?: { title: string }[] } };

/** Spoken names that differ from a simple-icons title/slug → the slug they mean. */
const ALIASES: Record<string, string> = {
  chatgpt: 'openai',
  gpt: 'openai',
  gpt4: 'openai',
  gpt4o: 'openai',
  openai: 'openai',
  claudeai: 'claude',
  anthropicclaude: 'claude',
  vscode: 'visualstudiocode',
  gcp: 'googlecloud',
  aws: 'amazonwebservices',
  twitter: 'x',
};

/** Case-, space- and punctuation-insensitive key: "Node.js" → "nodejs", " Git-Hub " → "github". */
const key = (s: string) => s.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '');

let index: Map<string, SiIcon> | undefined;

function build(): Map<string, SiIcon> {
  const bySlug = new Map<string, SiIcon>();
  for (const v of Object.values(icons) as unknown[]) {
    const i = v as SiIcon;
    if (i && typeof i === 'object' && typeof i.slug === 'string' && typeof i.svg === 'string') bySlug.set(i.slug, i);
  }
  const m = new Map<string, SiIcon>();
  // titles and slugs first (a slug wins over another icon's title), then simple-icons' own "aka" aliases
  for (const i of [...bySlug.values()].sort((a, b) => a.slug.localeCompare(b.slug))) if (!m.has(key(i.title))) m.set(key(i.title), i);
  for (const i of bySlug.values()) m.set(key(i.slug), i);
  const data = createRequire(import.meta.url)('simple-icons/icons.json') as SiData[];
  for (const d of data) {
    const i = bySlug.get(d.slug);
    if (!i) continue;
    for (const a of d.aliases?.aka ?? []) if (!m.has(key(a))) m.set(key(a), i);
  }
  for (const [a, slug] of Object.entries(ALIASES)) {
    const i = bySlug.get(slug);
    if (i) m.set(a, i);
    else m.delete(a); // an alias to a mark that is not in this simple-icons version must not fall through to a namesake
  }
  return m;
}

/**
 * Offline logo lookup by spoken name, title or slug (case/space/punctuation-insensitive, plus a small alias map:
 * "ChatGPT"/"GPT" → OpenAI, "claude" → Claude). `null` when the bundled set lacks it: the caller then falls back to
 * the tool's own site or repo (reel doc §6.4). Note: simple-icons 16 removed the OpenAI mark upstream.
 */
export function resolveLogo(name: string): Logo | null {
  const k = key(name);
  if (!k) return null;
  index ??= build();
  const i = index.get(k);
  return i ? { svg: i.svg, hex: i.hex, title: i.title, slug: i.slug } : null;
}

/** The slug of a `si:<slug>` logo reference (a topic asset), else undefined for a plain asset path. */
export function logoRef(ref: string): string | undefined {
  const m = /^si:(.+)$/.exec(ref);
  return m ? m[1] : undefined;
}

/** sRGB relative luminance of a 6-digit hex colour. */
function luminance(hex: string): number {
  const c = [0, 2, 4].map((o) => parseInt(hex.slice(o, o + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

/**
 * The SVG file written into a compiled project for a resolved logo: the mark in its brand colour, or white when
 * the brand colour is too dark for the dark logo tile (e.g. GitHub #181717). Deterministic.
 */
export function logoSvgFile(l: Logo): string {
  const fill = luminance(l.hex) < 0.05 ? 'FFFFFF' : l.hex.toUpperCase();
  return l.svg.replace(/^<svg /, `<svg fill="#${fill}" `);
}
