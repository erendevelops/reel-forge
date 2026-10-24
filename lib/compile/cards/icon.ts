import { type CompileContext, esc, num } from '../types';

/** Rounded logo tile (22% radius) shared by title cards and the list (reel doc §7.3 ToolIcon). */
export function toolIcon(ctx: CompileContext, logo: string | undefined, size: number, alt: string): string {
  const style = `width: ${num(size)}px; height: ${num(size)}px; border-radius: ${num(size * 0.22)}px;`;
  if (!logo) return `<div class="tool-icon" style="${style}"></div>`;
  return `<div class="tool-icon" style="${style}"><img src="${esc(ctx.assetsUrl(logo))}" alt="${esc(alt)}"></div>`;
}

export const TOOL_ICON_CSS =
  '.tool-icon { flex-shrink: 0; overflow: hidden; background: #0b0b0b; box-shadow: 0 8px 28px rgba(0,0,0,0.5); }\n' +
  '.tool-icon img { display: block; width: 100%; height: 100%; object-fit: cover; }';
