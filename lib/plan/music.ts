import { z } from 'zod';

/** Claude's 3–4 royalty-free track suggestions (spec §6 music); the user picks one in the app. */
export const MusicCandidatesSchema = z.object({
  candidates: z
    .array(
      z.object({
        title: z.string().min(1),
        artist: z.string().min(1),
        url: z.string().url().startsWith('https://', 'url must be https'),
        license: z.string().min(1, 'license text is required'),
        why: z.string().min(1),
        previewUrl: z.string().url().startsWith('https://').optional(),
        contentId: z.boolean().optional(),
      }),
    )
    .min(3)
    .max(4),
});
export type MusicCandidates = z.infer<typeof MusicCandidatesSchema>;

export function validateMusicCandidates(x: unknown): { ok: true } | { ok: false; errors: string[] } {
  const r = MusicCandidatesSchema.safeParse(x);
  return r.success ? { ok: true } : { ok: false, errors: r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) };
}
