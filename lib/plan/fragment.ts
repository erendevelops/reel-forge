import { z } from 'zod';

/**
 * `custom-animation` card (spec §6 "Topic assets & animations"): a Claude-authored, deterministic HTML/SVG + GSAP
 * fragment. `timeline` is JS made only of `tl.fromTo/to/set("<selector>", …, <seconds>)` calls with card-relative
 * positions; compile namespaces its ids/classes per card and offsets its times to absolute.
 */
export const FragmentParams = z.object({
  html: z.string(),
  css: z.string().default(''),
  timeline: z.string().default(''),
  label: z.string().optional(),
});
export type FragmentParams = z.infer<typeof FragmentParams>;

const TOL = 1e-3;
const ALLOWED = new Set(['tl.fromTo', 'tl.to', 'tl.set']);
const ARGS: Record<string, number> = { fromTo: 4, to: 3, set: 3 };
/** Keywords that may precede a `(` without being a call. */
const GROUPING = new Set(['if', 'for', 'while', 'switch', 'catch', 'return', 'typeof', 'void', 'in', 'of', 'case', 'do', 'else', 'delete']);

/** Banned anywhere (html, css and timeline, strings included): wall-clock time, randomness, timers, network, scripts. */
const BANNED_ANYWHERE: [RegExp, string][] = [
  [/\bDate\b/, 'Date'],
  [/\bMath\s*\.\s*random\b/, 'Math.random'],
  [/\b(setTimeout|setInterval|requestAnimationFrame|performance)\b/, 'timers (setTimeout/setInterval/requestAnimationFrame/performance)'],
  [/\b(fetch|XMLHttpRequest|WebSocket|EventSource|importScripts)\b/, 'fetch/network'],
  [/<\s*script/i, '<script'],
  [/\bhttps?:/i, 'external URL (http/https)'],
  [/(?:url\(\s*['"]?|(?:src|href)\s*=\s*['"]?)\/\//i, 'external URL (protocol-relative //)'],
  [/javascript:/i, 'javascript: URL'],
];
/** Banned identifiers in the timeline's code (outside strings); CSS keys such as `top` stay allowed in vars. */
const BANNED_CODE = /\b(window|document|globalThis|self|eval|Function|import|require|this|constructor|prototype|__proto__|new|gsap|async|await|yield|class)\b/;

export type TlCall = { method: 'fromTo' | 'to' | 'set'; start: number; end: number; target: [number, number]; pos: [number, number]; at: number };

/**
 * Masks comments and string contents with spaces (quotes kept, same length), so code checks never see inside
 * strings; a template literal's `${…}` stays code. Throws on an unterminated string/comment/template.
 */
export function maskJs(src: string): string {
  return scanJs(src).masked;
}

/** `maskJs` plus the comment ranges (to drop them from the compiled timeline). */
export function scanJs(src: string): { masked: string; comments: [number, number][] } {
  const comments: [number, number][] = [];
  const out = src.split('');
  const blank = (a: number, b: number) => {
    for (let k = a; k < b && k < out.length; k++) if (out[k] !== '\n') out[k] = ' ';
  };
  // a stack of frames: code frames count braces so a template `${` knows where it ends
  const stack: { mode: 'code' | 'tpl'; depth: number }[] = [{ mode: 'code', depth: 0 }];
  let i = 0;
  while (i < src.length) {
    const top = stack[stack.length - 1];
    const c = src[i];
    if (top.mode === 'tpl') {
      if (c === '\\') { blank(i, i + 2); i += 2; continue; }
      if (c === '`') { stack.pop(); i++; continue; }
      if (c === '$' && src[i + 1] === '{') { stack.push({ mode: 'code', depth: 0 }); i += 2; continue; }
      blank(i, i + 1); i++; continue;
    }
    if (c === '/' && src[i + 1] === '/') {
      const e = src.indexOf('\n', i);
      const end = e < 0 ? src.length : e;
      blank(i, end); comments.push([i, end]); i = end; continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      const e = src.indexOf('*/', i + 2);
      if (e < 0) throw new Error('unterminated comment');
      blank(i, e + 2); comments.push([i, e + 2]); i = e + 2; continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < src.length && src[j] !== c) {
        if (src[j] === '\\') j++;
        else if (src[j] === '\n') throw new Error('unterminated string');
        j++;
      }
      if (j >= src.length) throw new Error('unterminated string');
      blank(i + 1, j); i = j + 1; continue;
    }
    if (c === '`') { stack.push({ mode: 'tpl', depth: 0 }); i++; continue; }
    if (c === '{') top.depth++;
    if (c === '}') {
      if (stack.length > 1 && top.depth === 0) { stack.pop(); i++; continue; }
      top.depth--;
    }
    i++;
  }
  if (stack.length !== 1) throw new Error('unterminated template literal');
  return { masked: out.join(''), comments };
}

const OPEN = '([{';
const CLOSE = ')]}';

/** Index of the bracket closing the one at `open` in masked code, or -1. */
function closing(m: string, open: number): number {
  let d = 0;
  for (let i = open; i < m.length; i++) {
    if (OPEN.includes(m[i])) d++;
    else if (CLOSE.includes(m[i]) && --d === 0) return i;
  }
  return -1;
}

/** Top-level comma-separated argument ranges between `a` (after `(`) and `b` (the `)`). */
function splitArgs(m: string, a: number, b: number): [number, number][] {
  const out: [number, number][] = [];
  let d = 0;
  let s = a;
  for (let i = a; i < b; i++) {
    if (OPEN.includes(m[i])) d++;
    else if (CLOSE.includes(m[i])) d--;
    else if (m[i] === ',' && d === 0) { out.push([s, i]); s = i + 1; }
  }
  if (m.slice(s, b).trim() || out.length) out.push([s, b]);
  return out;
}

const trimRange = (src: string, [a, b]: [number, number]): [number, number] => {
  while (a < b && /\s/.test(src[a])) a++;
  while (b > a && /\s/.test(src[b - 1])) b--;
  return [a, b];
};

/** Parses and checks the timeline; returns its tl calls (ranges in `src`) and any rule violations. */
export function parseTimeline(src: string, duration?: number): { calls: TlCall[]; errors: string[] } {
  const errors: string[] = [];
  let m: string;
  try {
    m = maskJs(src);
  } catch (e) {
    return { calls: [], errors: [`timeline: ${(e as Error).message}`] };
  }
  if (/\.\s*from\s*\(/.test(m)) errors.push('timeline: tl.from( is not allowed (use fromTo: from() renders its start state only when played)');
  const banned = BANNED_CODE.exec(m);
  if (banned) errors.push(`timeline: ${banned[1].replace(/\s.*/, '')} is not allowed`);
  if (m.includes('=>')) errors.push('timeline: functions (=>) are not allowed');

  // every call site must be tl.fromTo/to/set at the top level; `(` after a keyword is grouping, after an operator too
  const calls: TlCall[] = [];
  let depth = 0;
  for (let i = 0; i < m.length; i++) {
    const c = m[i];
    if (c === '(') {
      let j = i - 1;
      while (j >= 0 && /\s/.test(m[j])) j--;
      const prev = j >= 0 ? m[j] : '';
      let callee: string | undefined;
      let calleeStart = j + 1;
      if (prev === ')' || prev === ']' || prev === '.' || prev === '`') callee = '(expression)';
      else if (/[\w$]/.test(prev)) {
        // read a dotted identifier chain backwards: a.b . c
        const parts: string[] = [];
        let k = j;
        for (;;) {
          let e = k;
          while (e >= 0 && /[\w$]/.test(m[e])) e--;
          parts.unshift(m.slice(e + 1, k + 1));
          calleeStart = e + 1;
          let q = e;
          while (q >= 0 && /\s/.test(m[q])) q--;
          if (q >= 0 && m[q] === '.') {
            let r = q - 1;
            while (r >= 0 && /\s/.test(m[r])) r--;
            if (r >= 0 && /[\w$]/.test(m[r])) { k = r; continue; }
            parts.unshift('(expression)');
          }
          break;
        }
        callee = parts.join('.');
        if (parts.length === 1 && GROUPING.has(callee)) callee = undefined;
        else if (parts.length === 1 && callee === 'function') callee = 'function';
      }
      if (callee !== undefined) {
        if (!ALLOWED.has(callee)) {
          errors.push(`timeline: only tl.fromTo/tl.to/tl.set calls are allowed (found ${callee}(…))`);
        } else if (depth !== 0) {
          errors.push(`timeline: ${callee}(…) must be a top-level statement`);
        } else {
          const close = closing(m, i);
          if (close < 0) { errors.push(`timeline: unbalanced ${callee}(`); break; }
          const method = callee.slice(3) as TlCall['method'];
          const args = splitArgs(m, i + 1, close).map((r) => trimRange(src, r));
          const where = `timeline ${callee}(${src.slice(args[0]?.[0] ?? i + 1, args[0]?.[1] ?? i + 1)}, …)`;
          if (args.length !== ARGS[method]) {
            errors.push(`${where}: needs ${ARGS[method]} arguments with an explicit numeric position last (has ${args.length})`);
          } else {
            const target = args[0];
            const pos = args[args.length - 1];
            const t = src.slice(...target);
            const p = src.slice(...pos);
            if (!/^(["'])[^"'\\]*\1$/.test(t)) errors.push(`${where}: the target must be a plain string selector literal`);
            else if (!/^\d+(\.\d+)?$/.test(p)) errors.push(`${where}: the position must be a numeric literal (card-relative seconds), got ${p}`);
            else {
              const at = Number(p);
              if (duration !== undefined && at > duration + TOL) errors.push(`${where}: position ${at}s is after the card ends (${duration}s)`);
              calls.push({ method, start: calleeStart, end: close + 1, target, pos, at });
            }
          }
        }
      }
    }
    if (OPEN.includes(c)) depth++;
    else if (CLOSE.includes(c)) depth--;
  }
  // `tl` may only appear as the callee of those calls (no tl.vars = …, no passing tl around)
  const uses = (m.match(/(?<![\w$.])tl\b/g) ?? []).length;
  if (uses > calls.length && !errors.length) errors.push('timeline: tl may only be used as tl.fromTo/tl.to/tl.set(…)');
  return { calls, errors };
}

/** All rule violations of a `custom-animation` fragment (`duration`: the card's length in seconds, if known). */
export function checkFragment(params: unknown, duration?: number): string[] {
  const parsed = FragmentParams.safeParse(params);
  if (!parsed.success) return parsed.error.issues.map((i) => `params.${i.path.join('.')}: ${i.message}`);
  const p = parsed.data;
  const errors: string[] = [];
  for (const field of ['html', 'css', 'timeline'] as const) {
    for (const [re, what] of BANNED_ANYWHERE) if (re.test(p[field])) errors.push(`${field}: ${what} is not allowed`);
  }
  if (/\son[a-z]+\s*=/i.test(p.html)) errors.push('html: inline event handlers (on…=) are not allowed');
  if (/<\s*(iframe|object|embed|link|meta|base|style|form|video|audio)\b/i.test(p.html)) errors.push('html: iframe/object/embed/link/meta/base/style/form/media elements are not allowed');
  if (/\sdata-(start|duration|track-index|composition-id)\s*=/i.test(p.html)) errors.push('html: HyperFrames timing attributes are not allowed');
  if (/@/.test(p.css)) errors.push('css: at-rules (@import/@keyframes/@media/@font-face) are not allowed');
  if (/\b(animation|transition)\b/i.test(p.css)) errors.push('css: animation/transition properties are not allowed (CSS time is not seekable; use the timeline)');
  if (/</.test(p.css)) errors.push('css: "<" is not allowed');
  if (cssRules(p.css) === undefined) errors.push('css: must be a flat list of "selector { declarations }" rules');
  errors.push(...parseTimeline(p.timeline, duration).errors);
  return errors;
}

const IDENT = '-?[_a-zA-Z][\\w-]*';

/** `#a.b c` → `#P-a.P-b c`, every comma part scoped under `#root`. */
function scopeSelector(sel: string, prefix: string, root: string): string {
  return sel
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => `#${root} ${s.replace(new RegExp(`([#.])(${IDENT})`, 'g'), (_, sig: string, id: string) => `${sig}${prefix}-${id}`)}`)
    .join(', ');
}

/** `url(#g)` references → `url(#P-g)`. */
const scopeUrls = (s: string, prefix: string) => s.replace(new RegExp(`url\\(\\s*(['"]?)#(${IDENT})\\1\\s*\\)`, 'g'), (_, q: string, id: string) => `url(${q}#${prefix}-${id}${q})`);

function cssRules(css: string): { sel: string; body: string }[] | undefined {
  const rules: { sel: string; body: string }[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css))) {
    if (css.slice(last, m.index).trim()) return undefined;
    rules.push({ sel: m[1].trim(), body: m[2].trim() });
    last = re.lastIndex;
  }
  return css.slice(last).trim() ? undefined : rules;
}

/**
 * The fragment, ready for the page: ids/classes (and `url(#…)`/`href="#…"` references) prefixed with `id-`, CSS
 * rules and timeline targets scoped under `#id`, timeline positions offset by `start` (card-relative → absolute),
 * comments dropped. Call only on a fragment that passed `checkFragment`. Deterministic.
 */
export function namespaceFragment(params: FragmentParams | Record<string, unknown>, id: string, start: number): { html: string; css: string; timeline: string } {
  const p = FragmentParams.parse(params);
  const prefix = id;
  const html = scopeUrls(p.html, prefix)
    .replace(/(\s)id\s*=\s*(["'])([^"']*)\2/g, (_, sp: string, q: string, v: string) => `${sp}id=${q}${prefix}-${v.trim()}${q}`)
    .replace(/(\s)class\s*=\s*(["'])([^"']*)\2/g, (_, sp: string, q: string, v: string) =>
      `${sp}class=${q}${v.split(/\s+/).filter(Boolean).map((c) => `${prefix}-${c}`).join(' ')}${q}`)
    .replace(/(\s(?:xlink:)?href)\s*=\s*(["'])#([^"']*)\2/g, (_, a: string, q: string, v: string) => `${a}=${q}#${prefix}-${v}${q}`);
  const rules = cssRules(p.css) ?? [];
  const css = rules.map((r) => `${scopeSelector(r.sel, prefix, id)} { ${scopeUrls(r.body, prefix)} }`).join('\n');

  const { calls, errors } = parseTimeline(p.timeline);
  if (errors.length) throw new Error(`custom-animation ${id}: ${errors.join('; ')}`);
  const fmt = (n: number) => String(Number(n.toFixed(3)));
  // in-place edits, applied back to front: scoped targets, absolute positions, comments dropped
  const edits: { a: number; b: number; text: string }[] = [];
  for (const c of calls) {
    edits.push({ a: c.target[0], b: c.target[1], text: JSON.stringify(scopeSelector(p.timeline.slice(c.target[0] + 1, c.target[1] - 1), prefix, id)) });
    edits.push({ a: c.pos[0], b: c.pos[1], text: fmt(start + c.at) });
  }
  for (const [a, b] of scanJs(p.timeline).comments) edits.push({ a, b, text: '' });
  edits.sort((x, y) => y.a - x.a);
  let js = p.timeline;
  for (const e of edits) js = js.slice(0, e.a) + e.text + js.slice(e.b);
  const body = js.split('\n').map((l) => l.trimEnd()).filter((l) => l.trim()).join('\n');
  // a block per card: the fragment's own let/const never collide with another card's
  return { html, css, timeline: body ? `{\n${body}\n}` : '' };
}
