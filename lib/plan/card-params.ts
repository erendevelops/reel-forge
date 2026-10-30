import { z } from 'zod';
import type { CardType } from './schema';
import { FragmentParams } from './fragment';

/**
 * Params schema of every card template, next to the plan schema so `validatePlan` can run them without importing
 * the compiler (no import cycle). The templates in `lib/compile/cards` parse with these same schemas.
 */

/**
 * Per-logo framing inside the tile (v5 Reel.tsx ToolIcon): `cover` fills the tile (photos, full-bleed app icons),
 * `contain` insets a mark at 62 % on the dark tile (e.g. the OpenAI/Whisper glyph). `logoPosition` is the
 * `object-position` of a cover crop (v5 Fooocus sample render: "25% 20%").
 */
export const LogoFraming = {
  logoFit: z.enum(['cover', 'contain']).default('cover'),
  logoPosition: z.string().regex(/^[a-z0-9.%\s-]+$/i).optional(),
};

/** A CSS hex colour (#rgb, #rrggbb or #rrggbbaa): card colours are never free CSS. */
export const HexColor = z.string().regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/, 'must be a hex colour (#rgb, #rrggbb or #rrggbbaa)');

const t = z.number().finite().nonnegative();

export const TitleCardParams = z.object({
  n: z.number().int().nonnegative(),
  name: z.string().min(1),
  logo: z.string().min(1).optional(),
  ...LogoFraming,
});

export const NumberedListItem = z.object({
  n: z.number().int().nonnegative(),
  name: z.string().min(1),
  logo: z.string().min(1).optional(),
  ...LogoFraming,
  /** Timeline time the row lands; before the card start = already landed (a list carried over from a previous scene). */
  at: t,
});
export const NumberedListParams = z.object({
  items: z.array(NumberedListItem).min(1),
  highlight: z.enum(['latest', 'none']).default('latest'),
});

export const LogoPopParams = z.object({
  img: z.string().min(1),
  left: z.number().finite(),
  top: z.number().finite(),
  rot: z.number().finite().optional(),
  width: z.number().positive().default(300),
  height: z.number().positive().default(300),
  fit: z.enum(['cover', 'contain']).default('contain'),
  /** `transparent`: just the logo, no tile, border or box shadow (a soft shadow follows the logo's own shape). */
  bg: z.union([HexColor, z.literal('transparent')]).optional(),
});

export const RollingNumberParams = z.object({
  from: z.number().finite(),
  to: z.number().finite(),
  locale: z.enum(['tr-TR', 'en-US']),
  suffix: z.string().optional(),
});

export const ChecklistParams = z.object({
  /** `at`: timeline time the tick pops; before the card start = already ticked. */
  items: z.array(z.object({ label: z.string().min(1), at: t })).min(1),
});

export const StampParams = z.object({ text: z.string().min(1) });

export const BarChartParams = z.object({
  bars: z.array(z.object({ label: z.string().min(1), value: z.number().finite().nonnegative() })).min(1),
});

export const TypedTitleParams = z.object({ text: z.string().min(1), label: z.string().min(1).optional() });

export const FollowOutroParams = z.object({ handle: z.string().min(1) });

export const CARD_PARAMS: Record<CardType, z.ZodTypeAny> = {
  'title-card': TitleCardParams,
  'numbered-list': NumberedListParams,
  'logo-pop': LogoPopParams,
  'rolling-number': RollingNumberParams,
  checklist: ChecklistParams,
  'bar-chart': BarChartParams,
  stamp: StampParams,
  'typed-title': TypedTitleParams,
  'follow-outro': FollowOutroParams,
  'custom-animation': FragmentParams,
};
