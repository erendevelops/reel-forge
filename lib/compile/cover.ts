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
 * The cover image: the frame at `cover.at` under a dark scrim, with a big headline (optional kicker pill and logo)
 * kept inside the feed-safe band (the centre 1080×1350 of a 9:16 frame). Static: the snapshot is one frame.
 */
export function renderCover(cover: Cover, ctx: CompileContext): Fragment {
  const plain = cover.title.replace(/\*/g, '');
  const longest = Math.max(...plain.split(/\s+/).map((w) => w.length), 1);
  const font = Math.min(sz(ctx, 84), (ctx.width * 0.8) / (0.6 * Math.max(longest, Math.min(plain.length, 16))));
  const band = ctx.height > ctx.width * 1.4 ? 0.17 : 0.08;
  const pos = cover.position;
  const scrim =
    pos === 'top'
      ? 'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.25) 35%, rgba(0,0,0,0) 60%)'
      : pos === 'bottom'
        ? 'linear-gradient(0deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.25) 35%, rgba(0,0,0,0) 60%)'
        : 'radial-gradient(ellipse at center, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.15) 70%, rgba(0,0,0,0) 100%)';
  const justify = pos === 'top' ? 'flex-start' : pos === 'bottom' ? 'flex-end' : 'center';
  const logo = cover.logo ? `<img class="rf-cover-logo" src="${esc(ctx.assetsUrl(cover.logo))}" alt="">` : '';
  const kicker = cover.kicker ? `<div class="rf-cover-kicker">${esc(cover.kicker)}</div>` : '';
  return {
    html: `<div class="rf-cover"><div class="rf-cover-scrim"></div><div class="rf-cover-text">${logo}${kicker}<h1 class="rf-cover-title">${titleHtml(cover.title)}</h1></div></div>`,
    css: [
      '.rf-cover { position: absolute; inset: 0; z-index: 50; }',
      `.rf-cover-scrim { position: absolute; inset: 0; background: ${scrim}; }`,
      `.rf-cover-text { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: ${justify}; align-items: center; text-align: center; gap: ${num(sz(ctx, 28))}px; padding: ${num(ctx.height * band)}px ${num(ctx.width * 0.07)}px; }`,
      `.rf-cover-title { color: #FFFFFF; font-weight: 800; font-size: ${num(font)}px; line-height: 1.2; letter-spacing: -0.01em; text-wrap: balance; text-shadow: 0 ${num(sz(ctx, 2))}px ${num(sz(ctx, 16))}px rgba(0,0,0,0.45); }`,
      `.rf-cover-hl { background: var(--accent); color: #111111; padding: 0 0.12em; border-radius: 0.12em; box-decoration-break: clone; -webkit-box-decoration-break: clone; text-shadow: none; }`,
      `.rf-cover-kicker { background: var(--accent); color: #111111; font-weight: 700; font-size: ${num(sz(ctx, 30))}px; padding: ${num(sz(ctx, 8))}px ${num(sz(ctx, 20))}px; border-radius: 999px; text-transform: uppercase; letter-spacing: ${num(sz(ctx, 3))}px; }`,
      `.rf-cover-logo { height: ${num(sz(ctx, 100))}px; max-width: 60%; object-fit: contain; filter: drop-shadow(0 ${num(sz(ctx, 6))}px ${num(sz(ctx, 20))}px rgba(0,0,0,0.5)); }`,
    ].join('\n'),
    timeline: '',
  };
}
