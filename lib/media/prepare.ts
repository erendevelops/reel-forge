import { run } from './run';

export interface PrepareClipOpts {
  from: number;
  duration: number;
  width: number;
  height: number;
  fps: 30 | 60;
}

/** Working clip: trimmed [from, from+duration+0.3], BT.709 TV range, audio stripped. */
export async function prepareClip(src: string, out: string, o: PrepareClipOpts): Promise<void> {
  const vf = `scale=${o.width}:${o.height}:flags=lanczos:out_range=tv,fps=${o.fps},format=yuv420p`;
  await run('ffmpeg', [
    '-y', '-v', 'error',
    '-ss', String(o.from), '-t', String(o.duration + 0.3),
    '-i', src,
    '-an',
    '-vf', vf,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '4', '-g', '30',
    '-color_range', 'tv', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
    out,
  ]);
}

/** Voice track: loudness-normalised 48 kHz WAV. */
export async function prepareVoice(src: string, out: string): Promise<void> {
  await run('ffmpeg', [
    '-y', '-v', 'error', '-i', src, '-vn',
    '-af', 'loudnorm=I=-15:TP=-1.5:LRA=11',
    '-ar', '48000', '-c:a', 'pcm_s16le',
    out,
  ]);
}

/** Final pass: video stream copied, audio loudness-normalised to target, AAC 320k. */
export async function finishLoudness(
  src: string,
  out: string,
  target: { I: number; TP: number },
): Promise<void> {
  await run('ffmpeg', [
    '-y', '-v', 'error', '-i', src,
    '-c:v', 'copy',
    '-af', `loudnorm=I=${target.I}:TP=${target.TP}:LRA=11`,
    '-ar', '48000', '-c:a', 'aac', '-b:a', '320k',
    '-movflags', '+faststart',
    out,
  ]);
}

/** Luma stats of the frame at time t after scaling to w x h. */
export async function lumaStats(
  file: string,
  t: number,
  w: number,
  h: number,
): Promise<{ yavg: number; ymin: number; ymax: number }> {
  const { stderr } = await run('ffmpeg', [
    '-v', 'info', '-ss', String(t), '-i', file, '-frames:v', '1',
    '-vf', `scale=${w}:${h},signalstats,metadata=print`,
    '-f', 'null', '-',
  ]);
  const get = (k: string): number => {
    const m = new RegExp('lavfi\\.signalstats\\.' + k + '=(-?[\\d.]+)').exec(stderr);
    if (!m) throw new Error(`signalstats ${k} not found for ${file}`);
    return Number(m[1]);
  };
  return { yavg: get('YAVG'), ymin: get('YMIN'), ymax: get('YMAX') };
}
