import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { makeClip } from '../helpers/media';
import { probe } from '../../lib/media/probe';
import type { Transcript } from '../../lib/media/transcribe';
import { run } from '../../lib/media/run';
import { planTrims, quietCuts, remapTimes, renderTrimmedTake, snapSegments } from '../../lib/talking/trim';

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

  it('snaps to the frame grid: video and audio agree after 10 joins, late words remap consistently', async () => {
    const fps = 30;
    const src = await makeClip(dir, { w: 160, h: 120, fps, seconds: 12, audio: true });
    // 11 ranges with off-grid boundaries (each would be up to a frame off if left unsnapped)
    const segs = Array.from({ length: 11 }, (_, i) => ({ from: i + 0.013, to: i + 0.511 + (i % 3) * 0.017 }));
    const out = path.join(dir, 'joins.mp4');
    const used = await renderTrimmedTake(src, segs, out);
    expect(used).toEqual(snapSegments(segs, fps));
    for (const s of used) {
      expect(Math.abs(s.from * fps - Math.round(s.from * fps))).toBeLessThan(1e-4);
      expect(Math.abs(s.to * fps - Math.round(s.to * fps))).toBeLessThan(1e-4);
    }
    const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,duration', '-of', 'json', out]);
    const streams = JSON.parse(stdout).streams as { codec_type: string; duration: string }[];
    const v = Number(streams.find((s) => s.codec_type === 'video')!.duration);
    const a = Number(streams.find((s) => s.codec_type === 'audio')!.duration);
    const total = used.reduce((acc, s) => acc + s.to - s.from, 0);
    expect(Math.abs(v - total)).toBeLessThanOrEqual(1 / fps + 1e-6);
    expect(Math.abs(a - v)).toBeLessThanOrEqual(1 / fps + 1e-6);
    // a word 0.2 s into the last range lands 0.2 s after the sum of the earlier (snapped) ranges, inside the video
    const last = used[used.length - 1];
    const word = { w: 'late', start: last.from + 0.2, end: last.from + 0.3 };
    const [m] = remapTimes({ language: 'en', words: [word] }, used).words;
    const before = used.slice(0, -1).reduce((acc, s) => acc + s.to - s.from, 0);
    expect(m.start).toBeCloseTo(before + 0.2, 6);
    expect(m.end).toBeLessThanOrEqual(v + 1e-6);
  }, 120000);

  it('normalises a variable-frame-rate take to its frame grid before trimming', async () => {
    const fps = 30;
    // VFR source: the first second keeps every other frame (15 fps), the rest is 30 fps; r_frame_rate stays 30
    const src = path.join(dir, 'vfr.mp4');
    await run('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', `testsrc2=size=160x120:rate=${fps}:duration=3`,
      '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=3',
      '-vf', "select='if(lt(t,1),not(mod(n,2)),1)'", '-fps_mode', 'vfr', '-c:v', 'libx264', '-preset', 'ultrafast', '-c:a', 'aac', src]);
    const count = async (f: string) => Number((await run('ffprobe', ['-v', 'error', '-count_frames', '-select_streams', 'v:0',
      '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', f])).stdout.trim());
    expect(await count(src)).toBeLessThan(3 * fps); // really VFR
    const out = path.join(dir, 'vfr-take.mp4');
    const used = await renderTrimmedTake(src, [{ from: 0.2, to: 1.4 }, { from: 2, to: 2.8 }], out);
    const total = used.reduce((acc, s) => acc + s.to - s.from, 0);
    // a constant-rate output: one frame per grid step, including the 15 fps stretch
    expect(await count(out)).toBe(Math.round(total * fps));
  }, 120000);
});

describe('quietCuts', () => {
  let dir: string;
  beforeAll(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'quiet-'));
  });
  afterAll(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('moves boundaries out of a word tail into the nearby silence, on the frame grid', async () => {
    // tone 0–1.05 s, silence 1.05–1.35 s, tone 1.35–2.5 s (a word whose tail outlasts the transcript's end time)
    const wav = path.join(dir, 'tone-gap.wav');
    await run('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=300:sample_rate=48000:duration=2.5',
      '-af', "volume='if(between(t,1.05,1.35),0,1)':eval=frame", wav]);
    // transcript-only boundaries: the first range ends at 1.0 (inside the tone), the next starts at 1.40 (inside it too)
    const segs = await quietCuts(wav, [{ from: 0, to: 1.0 }, { from: 1.4, to: 2.5 }], { fps: 25 });
    expect(segs[0].to).toBeGreaterThanOrEqual(1.08);
    expect(segs[0].to).toBeLessThanOrEqual(1.32);
    expect(segs[1].from).toBeGreaterThanOrEqual(1.08);
    expect(segs[1].from).toBeLessThanOrEqual(1.32);
    expect(segs[0].to).toBeLessThanOrEqual(segs[1].from);
    for (const s of segs) for (const b of [s.from, s.to]) expect(Math.abs(b * 25 - Math.round(b * 25))).toBeLessThan(1e-6);
  });

  it('leaves a boundary alone when there is no quieter point nearby', async () => {
    const wav = path.join(dir, 'flat.wav');
    await run('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'anoisesrc=d=2:c=white:a=0.3:seed=1:r=48000', wav]);
    const segs = await quietCuts(wav, [{ from: 0.4, to: 1.6 }], { fps: 25, search: 0, inward: 0 });
    expect(segs).toEqual([{ from: 0.4, to: 1.6 }]);
  });

  it('moves inward at most `inward` (a quiet closure inside the word never wins)', async () => {
    // silence 0.60–0.70 inside the kept words, tone elsewhere: the planned end 1.0 must not jump back to 0.64
    const wav = path.join(dir, 'closure.wav');
    await run('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=300:sample_rate=48000:duration=2',
      '-af', "volume='if(between(t,0.6,0.7),0,1)':eval=frame", wav]);
    const [s] = await quietCuts(wav, [{ from: 0, to: 1.0 }], { fps: 25, search: 0.12, inward: 0.08 });
    expect(s.to).toBeGreaterThanOrEqual(0.92);
  });
});
