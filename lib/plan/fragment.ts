import { z } from 'zod';

/**
 * `custom-animation` card (spec §6 "Topic assets & animations"): a Claude-authored, deterministic HTML/SVG + GSAP
 * fragment. Every part is checked against an allowlist, never a blacklist:
 * - `timeline`: only top-level `tl.fromTo|to|set("<selector>", <vars>[, <vars>], <seconds>)` statements whose vars
 *   are literals (identifier/string keys; number, string, boolean, null, nested object/array values). Card-relative
 *   positions; compile regenerates the calls from the parsed literals (scoped selectors, absolute times).
 * - `html`: a fixed set of HTML/SVG elements and attributes, quoted values, no entities but a few named ones.
 * - `css`: flat `selector { declarations }` rules; `url()` only `#id` or a relative asset path.
 */
export const FragmentParams = z.object({
  html: z.string(),
  css: z.string().default(''),
  timeline: z.string().default(''),
  label: z.string().optional(),
});
export type FragmentParams = z.infer<typeof FragmentParams>;

const TOL = 1e-3;

/** Friendlier messages for the usual suspects (the allowlists below reject them anyway). */
const BANNED_ANYWHERE: [RegExp, string][] = [
  [/\bDate\b/, 'Date'],
  [/\bMath\s*\.\s*random\b/, 'Math.random'],
  [/\b(setTimeout|setInterval|requestAnimationFrame|performance)\b/, 'timers (setTimeout/setInterval/requestAnimationFrame/performance)'],
  [/\b(fetch|XMLHttpRequest|WebSocket|EventSource|importScripts)\b/, 'fetch/network'],
  [/<\s*script/i, '<script'],
  [/\bhttps?:/i, 'external URL (http/https)'],
  [/(?:url\(\s*['"]?|(?:src|href)\s*=\s*['"]?)\/\//i, 'external URL (protocol-relative //)'],
  [/javascript:/i, 'javascript: URL'],
  [/\\/, 'backslash escapes (\\)'],
  [/&#/, 'numeric character references (&#)'],
];

// ------------------------------------------------------------------------------------------------ timeline

type Tok = { t: 'id' | 'num' | 'str' | 'p' | 'bad'; v: string; a: number; b: number };

/** Literal values of a GSAP vars object. */
export type Lit = number | string | boolean | null | Lit[] | { [k: string]: Lit };
export type TlCall = { method: 'fromTo' | 'to' | 'set'; selector: string; vars: Record<string, Lit>[]; at: number };

const METHODS: Record<string, number> = { fromTo: 2, to: 1, set: 1 };
/** Vars keys that would execute or inject (callbacks, markup, URLs) even with literal values. */
const BAD_KEY = /^(on.*|innerHTML|outerHTML|srcdoc|src|href|xlink:href|action|formaction|__proto__|constructor|prototype|callbackScope)$/i;
const SELECTOR = /^[\w\s#.,>+~*:-]+$/;

function tokenize(src: string, errors: string[]): { toks: Tok[]; ok: boolean } {
  const toks: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '/' && src[i + 1] === '/') { const e = src.indexOf('\n', i); i = e < 0 ? src.length : e; continue; }
    if (c === '/' && src[i + 1] === '*') {
      const e = src.indexOf('*/', i + 2);
      if (e < 0) { errors.push('timeline: unterminated comment'); return { toks, ok: false }; }
      i = e + 2; continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < src.length && src[j] !== c && src[j] !== '\n') j++;
      if (src[j] !== c) { errors.push('timeline: unterminated string'); return { toks, ok: false }; }
      toks.push({ t: 'str', v: src.slice(i + 1, j), a: i, b: j + 1 }); i = j + 1; continue;
    }
    const num = /^\d+(?:\.\d+)?/.exec(src.slice(i));
    if (num) { toks.push({ t: 'num', v: num[0], a: i, b: i + num[0].length }); i += num[0].length; continue; }
    const id = /^[A-Za-z_$][\w$]*/.exec(src.slice(i));
    if (id) { toks.push({ t: 'id', v: id[0], a: i, b: i + id[0].length }); i += id[0].length; continue; }
    if ('(){}[],:;.-'.includes(c)) { toks.push({ t: 'p', v: c, a: i, b: i + 1 }); i++; continue; }
    // anything else is reported and kept as a token no statement accepts, so parsing still reports the rest
    if (c === '`') errors.push('timeline: template literals (`) are not allowed');
    else if (c === '\\') errors.push('timeline: backslash escapes (\\) are not allowed');
    else if (c === '=' && src[i + 1] === '>') errors.push('timeline: functions (=>) are not allowed');
    else if (c === '=') errors.push('timeline: assignment (=) is not allowed');
    else errors.push(`timeline: "${c}" is not allowed (literal tl calls only)`);
    toks.push({ t: 'bad', v: c, a: i, b: i + 1 });
    i++;
  }
  return { toks, ok: true };
}

class ParseError extends Error {}

/**
 * Parses the timeline as a sequence of `tl.fromTo|to|set(...)` statements with literal arguments; returns the calls
 * and every rule violation (one per bad statement; parsing resumes after the next `;`).
 */
export function parseTimeline(src: string, duration?: number): { calls: TlCall[]; errors: string[] } {
  const errors: string[] = [];
  const calls: TlCall[] = [];
  const { toks, ok } = tokenize(src, errors);
  if (!ok) return { calls, errors };
  let k = 0;
  const peek = () => toks[k];
  const fail = (msg: string): never => { throw new ParseError(msg); };
  const take = (v: string, what: string) => {
    const t = toks[k];
    if (!t || t.t !== 'p' || t.v !== v) fail(`${what} (expected "${v}", found ${t ? `"${t.v}"` : 'the end'})`);
    k++;
  };
  const checkStr = (s: string, where: string) => {
    if (/random/i.test(s)) fail(`${where}: GSAP random values ("random(…)", stagger from "random") are not allowed (deterministic only)`);
  };
  const value = (where: string): Lit => {
    const t = toks[k];
    if (!t) return fail(`${where}: missing value`);
    if (t.t === 'num') { k++; return Number(t.v); }
    if (t.t === 'p' && t.v === '-' && toks[k + 1]?.t === 'num') { k += 2; return -Number(toks[k - 1].v); }
    if (t.t === 'str') { checkStr(t.v, where); k++; return t.v; }
    if (t.t === 'id' && (t.v === 'true' || t.v === 'false')) { k++; return t.v === 'true'; }
    if (t.t === 'id' && t.v === 'null') { k++; return null; }
    if (t.t === 'p' && t.v === '{') return object(where);
    if (t.t === 'p' && t.v === '[') {
      k++;
      const arr: Lit[] = [];
      while (!(peek()?.t === 'p' && peek().v === ']')) {
        arr.push(value(where));
        if (peek()?.t === 'p' && peek().v === ',') k++;
        else break;
      }
      take(']', `${where}: array`);
      return arr;
    }
    if (t.t === 'id') return fail(`${where}: identifier ${t.v} is not allowed in a value (literals only)`);
    return fail(`${where}: "${t.v}" is not allowed in a value (literals only)`);
  };
  const object = (where: string): Record<string, Lit> => {
    take('{', `${where}: vars must be an object literal`);
    const o: Record<string, Lit> = {};
    while (!(peek()?.t === 'p' && peek().v === '}')) {
      const key = toks[k];
      if (!key || (key.t !== 'id' && key.t !== 'str')) fail(`${where}: object keys must be identifiers or strings (found ${key ? `"${key.v}"` : 'the end'})`);
      if (BAD_KEY.test(key.v)) fail(`${where}: key ${key.v} is not allowed (callbacks/markup/URLs)`);
      k++;
      take(':', `${where}: key ${key.v}`);
      o[key.v] = value(where);
      if (peek()?.t === 'p' && peek().v === ',') k++;
      else break;
    }
    take('}', `${where}: object`);
    return o;
  };
  const statement = () => {
    const t0 = toks[k];
    if (!(t0.t === 'id' && t0.v === 'tl')) fail(`timeline: only tl.fromTo/tl.to/tl.set(…) calls are allowed, as top-level statements (found ${t0.v})`);
    k++;
    const dot = toks[k];
    const name = toks[k + 1];
    if (!(dot?.t === 'p' && dot.v === '.' && name?.t === 'id')) fail('timeline: tl may only be used as tl.fromTo/tl.to/tl.set(…)');
    if (name.v === 'from') fail('timeline: tl.from( is not allowed (use fromTo: from() renders its start state only when played)');
    if (!(name.v in METHODS)) fail(`timeline: tl may only be used as tl.fromTo/tl.to/tl.set(…) (found tl.${name.v})`);
    k += 2;
    const method = name.v as TlCall['method'];
    take('(', `timeline tl.${method}`);
    const target = toks[k];
    const where = `timeline tl.${method}(${target?.t === 'str' ? JSON.stringify(target.v) : '…'}, …)`;
    if (!target || target.t !== 'str') fail(`${where}: the target must be a plain string selector literal`);
    if (!SELECTOR.test(target.v)) fail(`${where}: the target selector may only use ids, classes, element names and combinators`);
    checkStr(target.v, where);
    k++;
    const vars: Record<string, Lit>[] = [];
    for (let n = 0; n < METHODS[method]; n++) {
      take(',', `${where}: needs ${METHODS[method] + 2} arguments with an explicit numeric position last`);
      vars.push(object(where));
    }
    take(',', `${where}: needs an explicit numeric position last`);
    const pos = toks[k];
    if (!pos || pos.t !== 'num') fail(`${where}: the position must be a numeric literal (card-relative seconds), got ${pos ? pos.v : 'nothing'}`);
    k++;
    take(')', `${where}: needs ${METHODS[method] + 2} arguments with an explicit numeric position last`);
    const at = Number(pos.v);
    if (duration !== undefined && at > duration + TOL) fail(`${where}: position ${at}s is after the card ends (${duration}s)`);
    calls.push({ method, selector: target.v, vars, at });
    const next = toks[k];
    if (next?.t === 'p' && next.v === ';') k++;
    else if (next && !(next.t === 'id' && next.v === 'tl')) fail(`timeline: only tl.fromTo/tl.to/tl.set(…) calls are allowed, as top-level statements (found "${next.v}" after tl.${method}(…))`);
  };
  while (k < toks.length) {
    if (toks[k].t === 'p' && toks[k].v === ';') { k++; continue; }
    try {
      statement();
    } catch (e) {
      if (!(e instanceof ParseError)) throw e;
      errors.push(e.message);
      // resume after the next top-level `;`
      let d = 0;
      while (k < toks.length) {
        const t = toks[k++];
        if (t.t !== 'p') continue;
        if ('([{'.includes(t.v)) d++;
        else if (')]}'.includes(t.v)) d--;
        else if (t.v === ';' && d <= 0) break;
      }
    }
  }
  return { calls, errors };
}

// ------------------------------------------------------------------------------------------------ html

const TAGS = new Set([
  'div', 'span', 'p', 'b', 'i', 'strong', 'em', 'br', 'small', 'sup', 'sub',
  'svg', 'g', 'defs', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text', 'tspan',
  'lineargradient', 'radialgradient', 'stop', 'clippath', 'mask', 'use', 'symbol', 'marker', 'pattern', 'title',
]);
const ATTRS = new Set([
  'id', 'class', 'style', 'viewbox', 'xmlns', 'xmlns:xlink', 'preserveaspectratio', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy',
  'r', 'rx', 'ry', 'fx', 'fy', 'dx', 'dy', 'width', 'height', 'd', 'points', 'pathlength', 'transform', 'opacity',
  'fill', 'fill-opacity', 'fill-rule', 'clip-rule', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin',
  'stroke-dasharray', 'stroke-dashoffset', 'stroke-opacity', 'stroke-miterlimit', 'vector-effect', 'offset',
  'stop-color', 'stop-opacity', 'gradientunits', 'gradienttransform', 'spreadmethod', 'patternunits', 'clippathunits',
  'maskunits', 'markerwidth', 'markerheight', 'refx', 'refy', 'orient', 'marker-start', 'marker-mid', 'marker-end',
  'text-anchor', 'dominant-baseline', 'font-size', 'font-weight', 'font-family', 'letter-spacing', 'clip-path', 'mask',
  'href', 'xlink:href', 'aria-hidden', 'role',
]);
const ENTITIES = /&(?!(?:amp|lt|gt|quot|apos|nbsp);)/;

type HtmlTok =
  | { k: 'text'; v: string }
  | { k: 'open'; name: string; attrs: [string, string][]; self: boolean }
  | { k: 'close'; name: string };

/** Url references in an attribute or CSS value: only `url(#id)` (plus relative asset paths when `assets`). */
function checkUrls(v: string, where: string, errors: string[], assets: boolean): void {
  const re = /url\(\s*(['"]?)([^'")]*)\1\s*\)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(v))) {
    const u = m[2].trim();
    const local = /^#[-\w]+$/.test(u);
    const asset = assets && /^[\w-]+(?:\/[\w.-]+)*\.[a-z0-9]+$/i.test(u) && !u.split('/').includes('..');
    if (!local && !asset) errors.push(`${where}: url(${u}) is not allowed (only url(#id)${assets ? ' or a relative asset path' : ''})`);
  }
  if (/url\(/i.test(v.replace(re, ''))) errors.push(`${where}: malformed url(`);
}

/** CSS checks shared by `css` rules and `style` attributes. */
function checkCssText(css: string, where: string, errors: string[]): void {
  if (/\\/.test(css)) errors.push(`${where}: backslash escapes (\\) are not allowed`);
  if (/@/.test(css)) errors.push(`${where}: at-rules (@import/@keyframes/@media/@font-face) are not allowed`);
  if (/expression\s*\(|-moz-binding|behavior\s*:/i.test(css)) errors.push(`${where}: expression()/binding/behavior are not allowed`);
  if (/\b(animation|transition)\b/i.test(css)) errors.push(`${where}: animation/transition properties are not allowed (CSS time is not seekable; use the timeline)`);
  if (/</.test(css)) errors.push(`${where}: "<" is not allowed`);
  checkUrls(css, where, errors, true);
}

function tokenizeHtml(html: string, errors: string[]): HtmlTok[] | undefined {
  const out: HtmlTok[] = [];
  let i = 0;
  while (i < html.length) {
    if (html.startsWith('<!--', i)) { errors.push('html: comments (<!-- -->) are not allowed'); return undefined; }
    if (html[i] === '<') {
      const close = /^<\/([a-zA-Z][a-zA-Z0-9]*)\s*>/.exec(html.slice(i));
      if (close) { out.push({ k: 'close', name: close[1] }); i += close[0].length; continue; }
      const open = /^<([a-zA-Z][a-zA-Z0-9]*)/.exec(html.slice(i));
      if (!open) { errors.push(`html: malformed markup near ${JSON.stringify(html.slice(i, i + 20))}`); return undefined; }
      let j = i + open[0].length;
      const attrs: [string, string][] = [];
      for (;;) {
        const end = /^\s*(\/?)>/.exec(html.slice(j));
        if (end) { out.push({ k: 'open', name: open[1], attrs, self: end[1] === '/' }); j += end[0].length; break; }
        // attributes must be whitespace-separated and quoted: `<svg/onload=…>` and unquoted values never parse
        const attr = /^\s+([a-zA-Z][a-zA-Z0-9:-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'))?/.exec(html.slice(j));
        if (!attr) { errors.push(`html: malformed tag <${open[1]}> near ${JSON.stringify(html.slice(j, j + 20))} (attributes need quoted values)`); return undefined; }
        attrs.push([attr[1], attr[2] ?? attr[3] ?? '']);
        j += attr[0].length;
      }
      i = j;
      continue;
    }
    const next = html.indexOf('<', i);
    const text = html.slice(i, next < 0 ? html.length : next);
    if (text.includes('>')) { errors.push('html: stray ">" in text'); return undefined; }
    out.push({ k: 'text', v: text });
    i += text.length;
  }
  return out;
}

function checkHtml(html: string, errors: string[]): HtmlTok[] | undefined {
  const toks = tokenizeHtml(html, errors);
  if (!toks) return undefined;
  for (const t of toks) {
    if (t.k === 'text') {
      if (ENTITIES.test(t.v)) errors.push('html: only &amp; &lt; &gt; &quot; &apos; &nbsp; entities are allowed in text');
      continue;
    }
    if (!TAGS.has(t.name.toLowerCase())) { errors.push(`html: <${t.name}> is not allowed (HTML/SVG shapes and text only)`); continue; }
    if (t.k === 'close') continue;
    for (const [name, v] of t.attrs) {
      const n = name.toLowerCase();
      const where = `html: <${t.name} ${name}>`;
      if (!ATTRS.has(n)) { errors.push(`${where}: attribute ${name} is not allowed`); continue; }
      if (ENTITIES.test(v)) errors.push(`${where}: entities are not allowed in attribute values`);
      if ((n === 'href' || n === 'xlink:href') && !/^#[-\w]+$/.test(v)) errors.push(`${where}: href must be a local #id reference`);
      if (n === 'style') checkCssText(v, where, errors);
      else checkUrls(v, where, errors, false);
    }
  }
  return toks;
}

// ------------------------------------------------------------------------------------------------ css

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

// ------------------------------------------------------------------------------------------------ checks

/** All rule violations of a `custom-animation` fragment (`duration`: the card's length in seconds, if known). */
export function checkFragment(params: unknown, duration?: number): string[] {
  const parsed = FragmentParams.safeParse(params);
  if (!parsed.success) return parsed.error.issues.map((i) => `params.${i.path.join('.')}: ${i.message}`);
  const p = parsed.data;
  const errors: string[] = [];
  for (const field of ['html', 'css', 'timeline'] as const) {
    for (const [re, what] of BANNED_ANYWHERE) if (re.test(p[field])) errors.push(`${field}: ${what} is not allowed`);
  }
  if (/\bon[a-z]+\s*=/i.test(p.html)) errors.push('html: inline event handlers (on…=) are not allowed');
  checkHtml(p.html, errors);
  checkCssText(p.css, 'css', errors);
  const rules = cssRules(p.css);
  if (rules === undefined) errors.push('css: must be a flat list of "selector { declarations }" rules');
  else for (const r of rules) if (!SELECTOR.test(r.sel)) errors.push(`css: selector ${JSON.stringify(r.sel)} may only use ids, classes, element names and combinators`);
  errors.push(...parseTimeline(p.timeline, duration).errors);
  return [...new Set(errors)];
}

// ------------------------------------------------------------------------------------------------ namespacing

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

const fmtNum = (n: number) => String(Number(n.toFixed(6)));
const IDENT_KEY = /^[A-Za-z_$][\w$]*$/;

/** A literal printed back as JS (stable: insertion order, JSON strings). */
function printLit(v: Lit): string {
  if (v === null) return 'null';
  if (typeof v === 'number') return fmtNum(v);
  if (typeof v === 'string') return JSON.stringify(v);
  if (typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return `[${v.map(printLit).join(', ')}]`;
  const parts = Object.entries(v).map(([k, x]) => `${IDENT_KEY.test(k) ? k : JSON.stringify(k)}: ${printLit(x)}`);
  return parts.length ? `{ ${parts.join(', ')} }` : '{}';
}

const attrEsc = (v: string) => v.replace(/"/g, '&quot;');

/**
 * The fragment, ready for the page: ids/classes (and `url(#…)`/`href="#…"` references) prefixed with `id-`, CSS
 * rules and timeline targets scoped under `#id`, timeline positions offset by `start` (card-relative → absolute).
 * HTML and timeline are re-emitted from the parsed tokens/literals, never passed through. Throws on a fragment that
 * fails `checkFragment`. Deterministic.
 */
export function namespaceFragment(params: FragmentParams | Record<string, unknown>, id: string, start: number): { html: string; css: string; timeline: string } {
  const errors = checkFragment(params);
  if (errors.length) throw new Error(`custom-animation ${id}: ${errors.join('; ')}`);
  const p = FragmentParams.parse(params);
  const prefix = id;
  const toks = tokenizeHtml(p.html, [])!;
  const html = toks
    .map((t) => {
      if (t.k === 'text') return t.v;
      if (t.k === 'close') return `</${t.name}>`;
      const attrs = t.attrs.map(([name, v]) => {
        const n = name.toLowerCase();
        let val = v;
        if (n === 'id') val = `${prefix}-${v.trim()}`;
        else if (n === 'class') val = v.split(/\s+/).filter(Boolean).map((c) => `${prefix}-${c}`).join(' ');
        else if (n === 'href' || n === 'xlink:href') val = `#${prefix}-${v.slice(1)}`;
        else val = scopeUrls(v, prefix);
        return ` ${name}="${attrEsc(val)}"`;
      });
      return `<${t.name}${attrs.join('')}${t.self ? '/' : ''}>`;
    })
    .join('');
  const rules = cssRules(p.css) ?? [];
  const css = rules.map((r) => `${scopeSelector(r.sel, prefix, id)} { ${scopeUrls(r.body, prefix)} }`).join('\n');
  const { calls } = parseTimeline(p.timeline);
  const timeline = calls
    .map((c) => `tl.${c.method}(${JSON.stringify(scopeSelector(c.selector, prefix, id))}, ${c.vars.map(printLit).join(', ')}, ${fmtNum(Number((start + c.at).toFixed(3)))});`)
    .join('\n');
  return { html, css, timeline };
}
