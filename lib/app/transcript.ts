import { z } from 'zod';

/** A Whisper transcript as `rf transcribe` writes it (analysis/transcript.json, transcript-trimmed.json). */
export const TranscriptSchema = z.object({
  language: z.string(),
  words: z.array(z.object({ w: z.string(), start: z.number(), end: z.number() })),
});
export type Transcript = z.infer<typeof TranscriptSchema>;

export class TranscriptEditError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TranscriptEditError';
  }
}

/**
 * The transcript with corrected word texts (spec §11 screen 5: "timings are kept"). One entry per original word: a
 * slot may hold several words ("hemen kurdum") but never disappears, so no timing ever moves.
 */
export function applyWordEdits(t: Transcript, words: string[]): Transcript {
  if (words.length !== t.words.length) throw new TranscriptEditError(`expected ${t.words.length} words, got ${words.length}`);
  const empty = words.findIndex((w) => !w.trim());
  if (empty >= 0) throw new TranscriptEditError(`word ${empty + 1} is empty`);
  return { ...t, words: t.words.map((x, i) => ({ ...x, w: words[i].trim() })) };
}

/** Word indexes grouped into display lines: a new line after `. ? !` or at a pause of at least `gap` seconds. */
export function lines(t: Transcript, gap = 0.6): number[][] {
  const out: number[][] = [];
  let cur: number[] = [];
  t.words.forEach((w, i) => {
    const prev = t.words[i - 1];
    if (cur.length && prev && (/[.?!…]$/.test(prev.w) || w.start - prev.end >= gap)) {
      out.push(cur);
      cur = [];
    }
    cur.push(i);
  });
  if (cur.length) out.push(cur);
  return out;
}
