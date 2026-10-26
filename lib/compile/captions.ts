import type { Plan } from '../plan';
import { type CompileContext, type Fragment, YELLOW, WHITE, clipDiv, esc, num, sz, tlFromTo, tlSet } from './types';

/** Caption block top as a fraction of height (reel doc §7.3: top 1300 of 1920). */
export const CAPTION_TOP = 0.677;
const FADE = 0.08;

/**
 * Word-build captions (reel doc §7.3): words accumulate as spoken, each fades in over 0.08 s
 * with no scale or bounce, and only the newest word is yellow. Like v5, only spoken words are laid out.
 */
export function renderCaptions(captions: Plan['captions'], ctx: CompileContext, panels: [number, number][] = []): Fragment {
  if (captions.style === 'none' || captions.groups.length === 0) return { html: '', css: '', timeline: '' };
  if (captions.style === 'one-word') return oneWord(captions, ctx, panels);
  if (captions.style === 'serif-small') return serifSmall(captions, ctx);

  const maxW = sz(ctx, 900);
  const css = [
    `#captions { position: absolute; left: 0; top: ${Math.round(CAPTION_TOP * ctx.height)}px; width: 100%; z-index: 5; }`,
    `#captions .cap-group { position: absolute; left: 50%; top: 0; width: ${num(maxW)}px; margin-left: ${num(-maxW / 2)}px; text-align: center; font-family: 'Inter', sans-serif; font-weight: 800; font-size: ${num(sz(ctx, 66))}px; line-height: 1.15; color: ${WHITE}; text-shadow: 0 4px 18px rgba(0,0,0,0.9), 0 2px 4px rgba(0,0,0,0.8); }`,
    // unspoken words take no space (display: none), so the line re-centres as words arrive, as in v5
    `#captions .cap-group.on-panel { text-shadow: none; -webkit-text-stroke: ${num(sz(ctx, 12))}px #111111; paint-order: stroke fill; }`,
    `#captions .cap-word { display: none; margin: 0 ${num(sz(ctx, 9))}px; opacity: 0; color: ${WHITE}; }`,
  ].join('\n');

  const groups: string[] = [];
  const tl: string[] = [];
  captions.groups.forEach((g, gi) => {
    const gid = `cap-${gi + 1}`;
    const start = g.words[0][1];
    const spans = g.words
      .map(([w], wi) => `<span id="${gid}-w${wi + 1}" class="cap-word">${esc(w)}</span>`)
      // no whitespace between the inline-block words: the 9 px side margins are the whole gap (18 px), as in v5
      .join('');
    const onPanel = panels.some(([a, b]) => start >= a - 1e-3 && start < b);
    groups.push(clipDiv(gid, start, g.end, onPanel ? 'cap-group on-panel' : 'cap-group', spans));
    g.words.forEach(([, t], wi) => {
      const sel = `#${gid}-w${wi + 1}`;
      tl.push(tlSet(sel, { display: 'inline-block' }, t));
      tl.push(tlFromTo(sel, { opacity: 0 }, { opacity: 1, duration: FADE, ease: 'none' }, t));
      tl.push(tlSet(sel, { color: YELLOW }, t));
      if (wi > 0) tl.push(tlSet(`#${gid}-w${wi}`, { color: WHITE }, t));
    });
  });

  return { html: `<div id="captions">${groups.join('')}</div>`, css, timeline: tl.join('\n') };
}

const top = (ctx: CompileContext) => `#captions { position: absolute; left: 0; top: ${Math.round(CAPTION_TOP * ctx.height)}px; width: 100%; z-index: 5; }`;

/**
 * One big word (onur.builds): only the word being spoken, yellow with a dark outline, cut in at its start and out
 * at the next word's start (the group clip ends the last one).
 */
function oneWord(captions: Plan['captions'], ctx: CompileContext, panels: [number, number][]): Fragment {
  const css = [
    top(ctx),
    `#captions .cap-group { position: absolute; left: 0; top: 0; width: 100%; text-align: center; }`,
    `#captions .cap-one { display: none; font-family: 'Inter', sans-serif; font-weight: 900; font-size: ${num(sz(ctx, 96))}px; line-height: 1.1; color: #FFD21F; -webkit-text-stroke: ${num(sz(ctx, 14))}px #111111; paint-order: stroke fill; }`,
  ];
  const groups: string[] = [];
  const tl: string[] = [];
  captions.groups.forEach((g, gi) => {
    const gid = `cap-${gi + 1}`;
    const start = g.words[0][1];
    const words = g.words.map(([w], wi) => `<div id="${gid}-w${wi + 1}" class="cap-one">${esc(w)}</div>`).join('');
    const onPanel = panels.some(([a, b]) => start >= a - 1e-3 && start < b);
    groups.push(clipDiv(gid, start, g.end, onPanel ? 'cap-group on-panel' : 'cap-group', words));
    g.words.forEach(([, t], wi) => {
      tl.push(tlSet(`#${gid}-w${wi + 1}`, { display: 'block' }, t));
      if (wi > 0) tl.push(tlSet(`#${gid}-w${wi}`, { display: 'none' }, t));
    });
  });
  return { html: `<div id="captions">${groups.join('')}</div>`, css: css.join('\n'), timeline: tl.join('\n') };
}

/** Small serif (msevimli_): the whole group as one quiet line; `*word*` in the plan renders italic. */
function serifSmall(captions: Plan['captions'], ctx: CompileContext): Fragment {
  const css = [
    top(ctx),
    `#captions .cap-group { position: absolute; left: 50%; top: 0; width: ${num(sz(ctx, 900))}px; margin-left: ${num(-sz(ctx, 450))}px; text-align: center; font-family: 'Times New Roman', Georgia, serif; font-weight: 400; font-size: ${num(sz(ctx, 44))}px; line-height: 1.2; color: ${WHITE}; text-shadow: 0 2px 10px rgba(0,0,0,0.6); }`,
    '#captions .cap-group em { font-style: italic; }',
  ];
  const groups: string[] = [];
  const tl: string[] = [];
  captions.groups.forEach((g, gi) => {
    const gid = `cap-${gi + 1}`;
    const start = g.words[0][1];
    const line = g.words
      .map(([w]) => {
        const m = /^\*(.+)\*$/.exec(w);
        return m ? `<em>${esc(m[1])}</em>` : esc(w.replace(/\*/g, ''));
      })
      .join(' ');
    groups.push(clipDiv(gid, start, g.end, 'cap-group', line));
    tl.push(tlFromTo(`#${gid}`, { opacity: 0 }, { opacity: 1, duration: 0.15, ease: 'none' }, start));
  });
  return { html: `<div id="captions">${groups.join('')}</div>`, css: css.join('\n'), timeline: tl.join('\n') };
}
