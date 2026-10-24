import path from 'node:path';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import { run } from '../../lib/media/run';

export interface ClipOpts {
  w: number;
  h: number;
  fps: number;
  seconds: number;
  audio?: boolean;
  fullRange?: boolean;
  rotate?: 0 | 90 | -90;
}

/** Generates a test clip with ffmpeg testsrc2 (+ sine audio) in `dir`; returns its path. */
export async function makeClip(dir: string, o: ClipOpts): Promise<string> {
  const id = randomUUID().slice(0, 8);
  const out = path.join(dir, `clip-${id}.mp4`);
  const base = o.rotate ? path.join(dir, `base-${id}.mp4`) : out;
  const args = ['-y', '-v', 'error', '-f', 'lavfi', '-i', `testsrc2=size=${o.w}x${o.h}:rate=${o.fps}:duration=${o.seconds}`];
  if (o.audio) args.push('-f', 'lavfi', '-i', `sine=frequency=440:sample_rate=48000:duration=${o.seconds}`);
  args.push('-c:v', 'libx264', '-preset', 'ultrafast');
  if (o.fullRange) args.push('-pix_fmt', 'yuvj420p', '-color_range', 'pc');
  else args.push('-pix_fmt', 'yuv420p');
  if (o.audio) args.push('-c:a', 'aac', '-shortest');
  args.push(base);
  await run('ffmpeg', args);
  if (o.rotate) {
    await run('ffmpeg', ['-y', '-v', 'error', '-display_rotation', String(o.rotate), '-i', base, '-c', 'copy', out]);
    await fs.rm(base, { force: true });
  }
  return out;
}
