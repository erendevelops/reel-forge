import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { makeClip } from '../helpers/media';
import { cropPath, faceTrack, facePosition, FACE_MODEL, type FaceTrack } from '../../lib/talking/reframe';

const SRC = { w: 1920, h: 1080 };

/** Face box 0.12 × 0.25 drifting linearly from x = 0.2 to 0.7 over `n` samples at 10 fps. */
function drift(n: number, x0 = 0.2, x1 = 0.7): FaceTrack {
  const boxes = Array.from({ length: n }, (_, i) => ({
    t: i / 10,
    x: x0 + ((x1 - x0) * i) / (n - 1),
    y: 0.3,
    bw: 0.12,
    bh: 0.25,
  }));
  return { ...SRC, boxes };
}

describe('cropPath', () => {
  it('cropPath keeps face inside', () => {
    const track = drift(121);
    const path = cropPath(track, SRC, '9:16');
    expect(path).toHaveLength(track.boxes.length);
    for (let i = 0; i < path.length; i++) {
      const c = path[i];
      const b = track.boxes[i];
      expect(c.w).toBe(path[0].w);
      expect(c.h).toBe(path[0].h);
      const m = 0.08 * c.w;
      const fx0 = b.x * SRC.w;
      const fx1 = (b.x + b.bw) * SRC.w;
      const fy0 = b.y * SRC.h;
      const fy1 = (b.y + b.bh) * SRC.h;
      expect(fx0 - c.x).toBeGreaterThanOrEqual(m - 1);
      expect(c.x + c.w - fx1).toBeGreaterThanOrEqual(m - 1);
      expect(fy0 - c.y).toBeGreaterThanOrEqual(0);
      expect(c.y + c.h - fy1).toBeGreaterThanOrEqual(0);
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.x + c.w).toBeLessThanOrEqual(SRC.w);
      if (i > 0) expect(Math.abs(c.x - path[i - 1].x)).toBeLessThanOrEqual(0.02 * SRC.w);
    }
  });

  it('crop window has the target ratio and fits the source', () => {
    const [c] = cropPath(drift(2), SRC, '9:16');
    expect(c.h).toBe(1080);
    expect(Math.abs(c.w / c.h - 9 / 16)).toBeLessThan(0.005);
    const [s] = cropPath(drift(2), SRC, '1:1');
    expect([s.w, s.h]).toEqual([1080, 1080]);
  });

  it('rate-limits ordinary motion to 2% of the width per sample', () => {
    // face drifts 0.3 -> 0.45 in 0.005 steps: well inside the window, so only the step limit applies
    const track = drift(31, 0.3, 0.45);
    const p = cropPath(track, SRC, '9:16', { smoothing: 0 });
    for (let i = 1; i < p.length; i++) expect(Math.abs(p[i].x - p[i - 1].x)).toBeLessThanOrEqual(0.02 * SRC.w);
  });

  it('containment wins: a face jumping 0.1 -> 0.8 is contained within one sample', () => {
    const track: FaceTrack = {
      ...SRC,
      boxes: [0, 1, 2, 3].map((i) => ({ t: i / 10, x: i === 0 ? 0.1 : 0.8, y: 0.3, bw: 0.1, bh: 0.2 })),
    };
    const p = cropPath(track, SRC, '9:16');
    for (let i = 1; i < p.length; i++) {
      const c = p[i];
      const m = 0.08 * c.w;
      expect(0.8 * SRC.w - c.x).toBeGreaterThanOrEqual(m - 1);
      expect(c.x + c.w - 0.9 * SRC.w).toBeGreaterThanOrEqual(m - 1);
    }
    // it moves only as far as containment needs: the face sits at the window's trailing margin, not centred
    expect(p[1].x + p[1].w - 0.9 * SRC.w).toBeLessThanOrEqual(0.08 * p[1].w + 1);
  });

  it('is deterministic and centres when no face was found', () => {
    expect(cropPath(drift(30), SRC, '9:16')).toEqual(cropPath(drift(30), SRC, '9:16'));
    const empty = cropPath({ ...SRC, boxes: [] }, SRC, '9:16');
    expect(empty).toHaveLength(1);
    expect(empty[0].x).toBe(Math.round((SRC.w - empty[0].w) / 2));
  });
});

describe('facePosition', () => {
  it('is the median face centre, centre when empty', () => {
    expect(facePosition({ ...SRC, boxes: [] })).toEqual({ x: 0.5, y: 0.5 });
    const t: FaceTrack = { ...SRC, boxes: [0.1, 0.2, 0.9].map((y, i) => ({ t: i, x: 0.4, y, bw: 0.2, bh: 0.1 })) };
    expect(facePosition(t)).toEqual({ x: 0.5, y: 0.25 });
  });
});

describe('face_track.py', () => {
  let dir: string;
  beforeAll(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'face-'));
  });
  afterAll(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it.skipIf(!existsSync(FACE_MODEL))('writes the { w, h, boxes } JSON contract', async () => {
    const src = await makeClip(dir, { w: 320, h: 180, fps: 30, seconds: 1 });
    const t = await faceTrack(src, { fps: 10 });
    expect(t.w).toBe(320);
    expect(t.h).toBe(180);
    expect(Array.isArray(t.boxes)).toBe(true);
    for (const b of t.boxes) {
      for (const k of ['t', 'x', 'y', 'bw', 'bh'] as const) expect(typeof b[k]).toBe('number');
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.bw).toBeLessThanOrEqual(1);
    }
  }, 120000);
});
