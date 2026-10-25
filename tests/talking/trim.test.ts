import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { makeClip } from '../helpers/media';
import { probe } from '../../lib/media/probe';
import type { Transcript } from '../../lib/media/transcribe';
import { planTrims, remapTimes, renderTrimmedTake } from '../../lib/talking/trim';

const tr = (ws: [number, number][]): Transcript => ({
  language: 'en',
  words: ws.map(([start, end], i) => ({ w: `w${i + 1}`, start, end })),
});

const o = { maxGap: 0.35, pad: 0.08 };

describe('planTrims', () => {
  it('planTrims cuts long pauses on word boundaries', () => {
    const segs = planTrims(tr([[0, 0.4], [0.5, 0.9], [2.0, 2.4]]), o);
    expect(segs).toHaveLength(2);
    // the cut (end of the first kept range .. start of the next) sits between 0.98 and 1.92
    expect(segs[0].to).toBeCloseTo(0.98, 6);
    expect(segs[1].from).toBeCloseTo(1.92, 6);
    expect(segs[0].from).toBe(0);
    expect(segs[1].to).toBeCloseTo(2.48, 6);
  });

  it('planTrims removes retakes', () => {
    const t = tr([[0, 0.4], [0.5, 0.9], [1.1, 1.5], [1.6, 1.95], [2.1, 2.5]]);
    const segs = planTrims(t, { ...o, retakes: [[1.0, 2.0]] });
    expect(segs.length).toBeGreaterThan(0);
    for (const s of segs) expect(s.to <= 1.0 || s.from >= 2.0).toBe(true);
    // the words outside the retake are still kept
    expect(segs.some((s) => s.from <= 0 && s.to >= 0.9)).toBe(true);
    expect(segs.some((s) => s.from <= 2.1 && s.to >= 2.5)).toBe(true);
  });

  it('never cuts inside a word and keeps short pauses', () => {
    const t = tr([[0.3, 0.6], [0.7, 1.0], [1.2, 1.5]]);
    const segs = planTrims(t, o);
    expect(segs).toEqual([{ from: 0.22, to: 1.58 }]);
  });

  it('pads never cross into the neighbouring word', () => {
    // gap 0.4 > maxGap 0.35 but 2 * pad 0.25 would overlap: the cut stays between the words
    const segs = planTrims(tr([[0, 0.4], [0.8, 1.2]]), { maxGap: 0.35, pad: 0.25 });
    expect(segs).toHaveLength(2);
    expect(segs[0].to).toBeLessThanOrEqual(segs[1].from);
    expect(segs[0].to).toBeGreaterThanOrEqual(0.4);
    expect(segs[1].from).toBeLessThanOrEqual(0.8);
  });
});

describe('remapTimes', () => {
  it('remapTimes shifts later words', () => {
    const t = tr([[0, 0.4], [0.5, 0.9], [2.0, 2.4]]);
    const m = remapTimes(t, planTrims(t, o));
    expect(m.words).toHaveLength(3);
    expect(m.words[0].start).toBeCloseTo(0, 6);
    expect(m.words[1].start).toBeCloseTo(0.5, 6);
    expect(Math.abs(m.words[2].start - 1.06)).toBeLessThanOrEqual(0.001);
    expect(Math.abs(m.words[2].end - 1.46)).toBeLessThanOrEqual(0.001);
    expect(m.language).toBe('en');
  });

  it('drops words that fall in removed ranges', () => {
    const t = tr([[0, 0.4], [1.1, 1.5], [2.1, 2.5]]);
    const m = remapTimes(t, planTrims(t, { ...o, retakes: [[1.0, 2.0]] }));
    expect(m.words.map((w) => w.w)).toEqual(['w1', 'w3']);
  });
});

describe('renderTrimmedTake', () => {
  let dir: string;
  beforeAll(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'trim-'));
  });
  afterAll(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('joins kept ranges, keeps audio in sync, tags BT.709 TV', async () => {
    const src = await makeClip(dir, { w: 320, h: 240, fps: 30, seconds: 4, audio: true });
    const out = path.join(dir, 'take.mp4');
    await renderTrimmedTake(src, [{ from: 0, to: 1 }, { from: 2, to: 2.5 }, { from: 3, to: 3.8 }], out);
    const p = await probe(out);
    expect(Math.abs(p.duration - 2.3)).toBeLessThanOrEqual(0.06);
    expect(p.hasAudio).toBe(true);
    expect(p.colorRange).toBe('tv');
    expect(p.colorSpace).toBe('bt709');
    expect(p.colorPrimaries).toBe('bt709');
    expect(p.colorTransfer).toBe('bt709');
    expect([p.width, p.height]).toEqual([320, 240]);
  }, 60000);
});
