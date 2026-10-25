import { type CompileContext, esc, num } from '../types';

export type LogoFit = 'cover' | 'contain';

/** v5's inset for contained logos: 62 % of the tile. */
export const CONTAIN_INSET = 0.62;

/** Rounded logo tile (22% radius) shared by title cards and the list (reel doc §7.3 ToolIcon). */
export function toolIcon(
  ctx: CompileContext,
  logo: string | undefined,
  size: number,
  alt: string,
  framing: { logoFit?: LogoFit; logoPosition?: string } = {},
): string {
  const style = `width: ${num(size)}px; height: ${num(size)}px; border-radius: ${num(size * 0.22)}px;`;
  if (!logo) return `<div class="tool-icon" style="${style}"></div>`;
  const fit = framing.logoFit ?? 'cover';
  const img =
    fit === 'contain'
      ? `width: ${num(CONTAIN_INSET * 100)}%; height: ${num(CONTAIN_INSET * 100)}%; object-fit: contain;`
      : `width: 100%; height: 100%; object-fit: cover;${framing.logoPosition ? ` object-position: ${esc(framing.logoPosition)};` : ''}`;
  return `<div class="tool-icon tool-icon-${fit}" style="${style}"><img src="${esc(ctx.assetsUrl(logo))}" alt="${esc(alt)}" style="${img}"></div>`;
}

export const TOOL_ICON_CSS =
  '.tool-icon { flex-shrink: 0; overflow: hidden; background: #0b0b0b; box-shadow: 0 8px 28px rgba(0,0,0,0.5); }\n' +
  '.tool-icon-contain { display: flex; align-items: center; justify-content: center; }\n' +
  '.tool-icon img { display: block; }';
