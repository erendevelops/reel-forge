import type { Plan } from '../plan';
import { type CompileContext, type Fragment, esc, num, sz } from './types';

type Cover = NonNullable<Plan['cover']>;

/** `*word*` marks the words drawn on an accent highlight. */
function titleHtml(title: string): string {
  return title
    .split(/(\*[^*]+\*)/)
    .map((part) => (/^\*[^*]+\*$/.test(part) ? `<span class="rf-cover-hl">${esc(part.slice(1, -1))}</span>` : esc(part)))
    .join('')
    .replace(/\n/g, '<br>');
}

/**
 * The cover image: the frame at `cover.at` under a scrim, with a headline (optional kicker pill and logo) kept inside
 * the feed-safe band (the centre 1080×1350 of a 9:16 frame). Static: the snapshot is one frame.
 */
export function renderCover(cover: Cover, ctx: CompileContext): Fragment {
  const plain = cover.title.replace(/\*/g, '');
  const longest = Math.max(...plain.split(/\s+/).map((w) => w.length), 1);
  const st = cover.style;
  const max = st === 'clean' ? 84 : st === 'card' ? 88 : 108;
  const font = Math.min(sz(ctx, max), (ctx.width * (st === 'card' ? 0.7 : 0.82)) / (0.6 * Math.max(longest, Math.min(plain.length, 14))));
  const band = ctx.height > ctx.width * 1.4 ? 0.17 : 0.08;
  const pos = cover.position;
  const a = st === 'accent' ? [0.78, 0.4] : st === 'card' ? [0.35, 0.12] : [0.55, 0.25];
  const scrim =
    pos === 'center'
      ? `radial-gradient(ellipse at center, rgba(0,0,0,${a[0] * 0.7}) 0%, rgba(0,0,0,${a[1] * 0.6}) 70%, rgba(0,0,0,0) 100%)`
      : `linear-gradient(${pos === 'top' ? 180 : 0}deg, rgba(0,0,0,${a[0]}) 0%, rgba(0,0,0,${a[1]}) 38%, rgba(0,0,0,0) 65%)`;
  const justify = pos === 'top' ? 'flex-start' : pos === 'bottom' ? 'flex-end' : 'center';
  const logo = cover.logo ? `<img class="rf-cover-logo" src="${esc(ctx.assetsUrl(cover.logo))}" alt="">` : '';
  const kicker = cover.kicker ? `<div class="rf-cover-kicker">${esc(cover.kicker)}</div>` : '';
  const bar = st === 'accent' ? '<div class="rf-cover-bar"></div>' : '';
  const title =
    st === 'card'
      ? 'color: #111111; background: #FFFFFF; padding: 0.32em 0.6em 0.38em; border-radius: 0.38em; box-shadow: 0 0.12em 0.6em rgba(0,0,0,0.35);'
      : `color: #FFFFFF; text-shadow: 0 ${num(sz(ctx, 3))}px ${num(sz(ctx, st === 'accent' ? 24 : 16))}px rgba(0,0,0,0.5);`;
  return {
    html: `<div class="rf-cover"><div class="rf-cover-scrim"></div><div class="rf-cover-text">${logo}${kicker}${bar}<h1 class="rf-cover-title">${titleHtml(cover.title)}</h1></div></div>`,
    css: [
      '.rf-cover { position: absolute; inset: 0; z-index: 50; }',
      `.rf-cover-scrim { position: absolute; inset: 0; background: ${scrim}; }`,
      `.rf-cover-text { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: ${justify}; align-items: center; text-align: center; gap: ${num(sz(ctx, 26))}px; padding: ${num(ctx.height * band)}px ${num(ctx.width * 0.07)}px; }`,
      `.rf-cover-title { font-weight: ${st === 'clean' ? 800 : 900}; font-size: ${num(font)}px; line-height: 1.12; letter-spacing: -0.02em; text-wrap: balance; ${title} }`,
      `.rf-cover-bar { width: ${num(sz(ctx, 96))}px; height: ${num(sz(ctx, 10))}px; border-radius: 999px; background: var(--accent); }`,
      '.rf-cover-hl { color: var(--accent); }',
      `.rf-cover-kicker { background: var(--accent); color: #111111; font-weight: 700; font-size: ${num(sz(ctx, 30))}px; padding: ${num(sz(ctx, 8))}px ${num(sz(ctx, 20))}px; border-radius: 999px; text-transform: uppercase; letter-spacing: ${num(sz(ctx, 3))}px; }`,
      `.rf-cover-logo { height: ${num(sz(ctx, 100))}px; max-width: 60%; object-fit: contain; filter: drop-shadow(0 ${num(sz(ctx, 6))}px ${num(sz(ctx, 20))}px rgba(0,0,0,0.5)); }`,
    ].join('\n'),
    timeline: '',
  };
}
