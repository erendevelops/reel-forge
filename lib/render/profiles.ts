import { TV_BT709_TAGS } from '../media/color';

export type RenderProfile = 'draft' | 'final';

export interface Profile {
  baseCodec: 'ffv1' | 'x264';
  basePreset?: string;
  baseCrf?: number;
  compositeCrf: number;
  compositePreset: string;
  hfQuality: 'draft' | 'delivery';
  qa: 'skip' | 'full';
}

/**
 * draft: fast previews for iteration. final: the only path to deliverables (Plan 1 behaviour, lossless base, CRF 10).
 * Both keep BT.709 TV tags and add no colour filters: speed never changes footage colour.
 */
export const PROFILES: Record<RenderProfile, Profile> = {
  draft: { baseCodec: 'x264', basePreset: 'veryfast', baseCrf: 16, compositeCrf: 23, compositePreset: 'veryfast', hfQuality: 'draft', qa: 'skip' },
  final: { baseCodec: 'ffv1', compositeCrf: 10, compositePreset: 'slow', hfQuality: 'delivery', qa: 'full' },
};

/** Video encode args of the base (footage-only) track. */
export function baseEncodeArgs(profile: RenderProfile): string[] {
  const p = PROFILES[profile];
  if (p.baseCodec === 'ffv1') return ['-c:v', 'ffv1', '-level', '3', '-pix_fmt', 'yuv420p', ...TV_BT709_TAGS];
  return ['-c:v', 'libx264', '-preset', p.basePreset ?? 'veryfast', '-crf', String(p.baseCrf ?? 16), '-g', '30', '-pix_fmt', 'yuv420p', ...TV_BT709_TAGS];
}

/** Video encode args of the delivered composite; an explicit `crf` overrides the profile's. */
export function compositeEncodeArgs(profile: RenderProfile, crf?: number): string[] {
  const p = PROFILES[profile];
  return ['-c:v', 'libx264', '-preset', p.compositePreset, '-crf', String(crf ?? p.compositeCrf), '-g', '30', '-pix_fmt', 'yuv420p', ...TV_BT709_TAGS];
}

/** HyperFrames CLI quality flags for a profile. */
export function hfRenderArgs(profile: RenderProfile): string[] {
  return ['--quality', PROFILES[profile].hfQuality];
}
