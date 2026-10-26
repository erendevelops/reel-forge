import { z } from 'zod';

/** analysis/music-candidates.json as the video-core music reference describes it. */
export const CandidatesSchema = z.object({
  note: z.string().optional(),
  candidates: z.array(
    z.object({
      title: z.string(),
      artist: z.string().optional(),
      url: z.string().url().regex(/^https:\/\//),
      license: z.string(),
      why: z.string(),
      contentId: z.boolean().optional(),
    }),
  ),
});
export type Candidate = z.infer<typeof CandidatesSchema>['candidates'][number];

export const MUSIC_EXT = ['.mp3', '.wav', '.m4a', '.ogg', '.flac'];
export const MUSIC_MAX_BYTES = 50 * 1024 * 1024;

/** A file name safe for inputs/music/: no path, Unicode letters/digits/`-_.` only, spaces as dashes, audio extensions only. */
export function safeMusicName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? '';
  const dot = base.lastIndexOf('.');
  const ext = dot >= 0 ? base.slice(dot) : '';
  if (!MUSIC_EXT.includes(ext.toLowerCase())) throw new Error(`not an audio file (${MUSIC_EXT.join(', ')}): ${name}`);
  const stem = base
    .slice(0, dot)
    .replace(/[^\p{L}\p{N}\s_.-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[.-]+/, '');
  return `${stem || 'track'}${ext}`;
}
