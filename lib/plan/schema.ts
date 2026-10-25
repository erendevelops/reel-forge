import { z } from 'zod';

export const CARD_TYPES = [
  'title-card', 'numbered-list', 'logo-pop', 'rolling-number', 'checklist',
  'bar-chart', 'stamp', 'typed-title', 'follow-outro',
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
});

/** `from`/`to` are source in/out; `at` is the timeline position; `punch` is a timeline time. */
export const ShotSchema = z
  .object({ src: z.string().min(1), from: sec, to: sec, at: sec, punch: sec.optional() })
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
    /** Face centre in the scene's footage, 0–1 of width/height (e.g. `facePosition(track)`); default centre. */
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

export const PlanSchema = z.object({
  version: z.literal(1),
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
});

export type Selection = z.infer<typeof SelectionSchema>;
export type Shot = z.infer<typeof ShotSchema>;
export type Card = z.infer<typeof CardSchema>;
export type Scene = z.infer<typeof SceneSchema>;
export type CaptionGroup = z.infer<typeof CaptionGroupSchema>;
export type SfxCue = z.infer<typeof SfxCueSchema>;
export type Music = z.infer<typeof MusicSchema>;
export type Plan = z.infer<typeof PlanSchema>;
