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

const norm = (s: string) => s.toLocaleLowerCase('tr').replace(/[^\p{L}\p{N}]+/gu, '');

/**
 * Captions follow the user's corrected transcript: each caption word starting at a transcript word's time (±0.03 s)
 * whose text differs from it gets the corrected text, keeping the caption's own trailing punctuation. A caption that
 * splits a multi-word slot ("hemen kurdum") keeps its first token. Only for Claude's saves; the user's own caption
 * edits are never synced.
 */
export function syncCaptions<P extends { captions: { groups: { words: [string, number][] }[] } }>(plan: P, t: Transcript): { plan: P; fixed: number } {
  const p = structuredClone(plan);
  let fixed = 0;
  for (const g of p.captions.groups) {
    for (const word of g.words) {
      const tw = t.words.find((x) => Math.abs(x.start - word[1]) <= 0.03);
      if (!tw) continue;
      const want = norm(tw.w);
      const have = norm(word[0]);
      if (have === want || have === norm(tw.w.split(/\s+/)[0] ?? '')) continue;
      const tail = /[.,!?;:…]+$/.exec(word[0])?.[0] ?? '';
      word[0] = tw.w.replace(/[.,!?;:…]+$/, '') + tail;
      fixed++;
    }
  }
  return { plan: p, fixed };
}
