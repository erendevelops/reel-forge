import { run } from '../media/run';
import { npx } from '../media/npx';
import { hfRenderArgs, type RenderProfile } from './profiles';

export interface RenderOpts {
  fps: number;
  crf?: number;
  format?: 'mp4' | 'mov';
  /** Default 'final' (delivery quality). */
  profile?: RenderProfile;
  /** HyperFrames parallel workers; default its 'auto'. */
  workers?: number;
}

/*
 * Colour tags: hyperframes@0.8.191 mp4 output was observed (ffprobe, 3 s synthetic plan) as
 * `High, yuv420p, color_range=tv, color_space=bt709, color_transfer=bt709, color_primaries=bt709`,
 * so no remux step (-bsf:v h264_metadata) is needed. The render test asserts this.
 */

/** Renders a compiled HyperFrames project directory to `out` (PNG frame extraction for colour fidelity). */
export async function render(projectDir: string, out: string, o: RenderOpts): Promise<void> {
  const args = [
    '-y', 'hyperframes@0.8.191', 'render', projectDir,
    '-o', out, '-f', String(o.fps),
    ...hfRenderArgs(o.profile ?? 'final'), '--video-frame-format', 'png',
  ];
  if (o.workers !== undefined) args.push('--workers', String(o.workers));
  if (o.format === 'mov') args.push('--format', 'mov');
  if (o.crf !== undefined && o.format !== 'mov') args.push('--crf', String(o.crf));
  const [cmd, a] = npx(args);
  await run(cmd, a, { timeoutMs: 30 * 60 * 1000 });
}
