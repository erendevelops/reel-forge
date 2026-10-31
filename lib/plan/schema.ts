import { z } from 'zod';

export const CARD_TYPES = [
  'title-card', 'numbered-list', 'logo-pop', 'rolling-number', 'checklist',
  'bar-chart', 'stamp', 'typed-title', 'follow-outro', 'custom-animation',
] as const;
export const CAPTION_STYLES = ['word-build', 'one-word', 'serif-small', 'none'] as const;
export const LAYOUTS = ['full-face', 'split', 'full-graphics', 'broll'] as const;
export const RATIOS = ['9:16', '16:9', '1:1', '4:5'] as const;

export type CardType = (typeof CARD_TYPES)[number];
export type CaptionStyle = (typeof CAPTION_STYLES)[number];
export type Layout = (typeof LAYOUTS)[number];
export type Ratio = (typeof RATIOS)[number];

const CardTypeSchema = z.enum(CARD_TYPES);
const CaptionStyleSchema = z.enum(CAPTION_STYLES);
const LayoutSchema = z.enum(LAYOUTS);
const RatioSchema = z.enum(RATIOS);

const sec = z.number().finite().nonnegative();

export const SelectionSchema = z.object({
  captions: CaptionStyleSchema,
  layouts: z.array(LayoutSchema),
  cards: z.array(CardTypeSchema),
  sfx: z.boolean(),
  music: z.boolean(),
  punchIns: z.boolean(),
  thumbnail: z.boolean(),
  /**
   * "Topic assets & animations" (spec §6): Claude may resolve logos for named tools (`si:<slug>` references) and
   * author `custom-animation` fragments. Off unless ticked (the talking-head preset will tick it by default).
   */
  topicAssets: z.boolean().default(false),
});

/**
 * `from`/`to` are source in/out; `at` is the timeline position; `punch` is a timeline time. `aspect` is the clip's
 * own width/height (default: the output frame's, i.e. a working clip prepared at the output size); the split face
 * card takes this aspect so the whole source frame shows, never cropped into the face.
 */
export const ShotSchema = z
  .object({ src: z.string().min(1), from: sec, to: sec, at: sec, punch: sec.optional(), aspect: z.number().finite().positive().optional() })
  .refine((s) => s.to > s.from, { message: 'shot "to" must be greater than "from"' });

export const CardSchema = z
  .object({
    type: CardTypeSchema,
    start: sec,
    end: sec,
    params: z.record(z.string(), z.unknown()),
  })
  .refine((c) => c.end > c.start, { message: 'card end must be greater than start' });

export const SceneSchema = z
  .object({
    id: z.string().min(1),
    start: sec,
    end: sec,
    say: z.string(),
    why: z.string(),
    layout: LayoutSchema.optional(),
    /**
     * Face centre in the scene's footage, 0–1 of width/height (e.g. `facePosition(track)`); default centre. Only pans a
     * full-frame cover (never zooms); the split face card shows the whole source frame and ignores it.
     */
    facePos: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).optional(),
    shots: z.array(ShotSchema),
    cards: z.array(CardSchema),
    ratioOverrides: z.record(RatioSchema, z.record(z.string(), z.unknown())).optional(),
  })
  .refine((s) => s.end > s.start, { message: 'scene end must be greater than start' });

export const CaptionGroupSchema = z.object({
  words: z.array(z.tuple([z.string(), sec])).min(1),
  end: sec,
});

export const SfxCueSchema = z.object({ file: z.string().min(1), at: sec, volume: z.number().min(0) });

export const MusicSchema = z.object({
  src: z.string().min(1),
  mediaStart: sec,
  volume: z.number().min(0),
  fadeOut: sec,
});

/** A BCP-47 language tag (`tr`, `en`, `en-US`): the spoken language of the footage, which captions follow (spec §7). */
export const LangSchema = z.string().regex(/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/, 'must be a BCP-47 language tag such as "tr" or "en"');

const Hex = z.string().regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'must be a hex colour (#rgb or #rrggbb)');

export const PlanSchema = z.object({
  version: z.literal(1),
  /** Emitted as `<html lang>`, so CSS text-transform (uppercase card labels) cases per language (Turkish i → İ). */
  lang: LangSchema,
  mode: z.enum(['reel', 'app']),
  fps: z.union([z.literal(30), z.literal(60)]),
  duration: z.number().finite().positive(),
  ratios: z.array(RatioSchema).min(1),
  selection: SelectionSchema,
  scenes: z.array(SceneSchema).min(1),
  captions: z.object({ style: CaptionStyleSchema, groups: z.array(CaptionGroupSchema) }),
  sfx: z.array(SfxCueSchema),
  voice: z.object({ src: z.string().min(1) }).optional(),
  music: MusicSchema.optional(),
  /**
   * The cover image (thumbnail option): the frame at `at` under a scrim with a big headline; `*word*` in the title
   * is drawn on an accent highlight. Without it the app grabs a plain frame.
   */
  cover: z
    .object({
      at: sec,
      title: z.string().min(1).max(80),
      kicker: z.string().min(1).max(40).optional(),
      position: z.enum(['top', 'center', 'bottom']).default('bottom'),
      /** `accent`: bold title with an accent bar and accent `*words*`; `card`: dark title on a white card; `clean`: plain white title. */
      style: z.enum(['accent', 'card', 'clean']).default('accent'),
      logo: z.string().min(1).optional(),
    })
    .optional(),
  /** Panel colours behind graphics (split/full-graphics). Required for app videos: the brand's own ground and ink. */
  look: z
    .object({
      background: Hex,
      ink: Hex.optional(),
      /** The video's design kit (spec §6 "One look per video"): card surface, accent, muted text, corner radius (px). */
      card: Hex.optional(),
      accent: Hex.optional(),
      muted: Hex.optional(),
      positive: Hex.optional(),
      negative: Hex.optional(),
      radius: z.number().min(0).max(120).optional(),
      font: z.enum(['Inter', 'Nunito']).optional(),
    })
    .optional(),
});

export type Selection = z.infer<typeof SelectionSchema>;
export type Shot = z.infer<typeof ShotSchema>;
export type Card = z.infer<typeof CardSchema>;
export type Scene = z.infer<typeof SceneSchema>;
export type CaptionGroup = z.infer<typeof CaptionGroupSchema>;
export type SfxCue = z.infer<typeof SfxCueSchema>;
export type Music = z.infer<typeof MusicSchema>;
export type Plan = z.infer<typeof PlanSchema>;
