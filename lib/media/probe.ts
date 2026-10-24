import { run } from './run';

export interface Probe {
  duration: number;
  width: number;
  height: number;
  displayWidth: number;
  displayHeight: number;
  rotation: number;
  fps: number;
  codec: string;
  pixFmt: string;
  colorRange: 'tv' | 'pc' | 'unknown';
  colorSpace: string;
  hasAudio: boolean;
}

function rational(s: string | undefined): number {
  if (!s) return 0;
  const [n, d] = s.split('/').map(Number);
  if (d === undefined) return n;
  return d ? n / d : 0;
}

export async function probe(file: string): Promise<Probe> {
  const { stdout } = await run('ffprobe', [
    '-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', file,
  ]);
  const j = JSON.parse(stdout);
  const streams: any[] = j.streams ?? [];
  const v = streams.find((s) => s.codec_type === 'video');
  if (!v) throw new Error(`no video stream in ${file}`);
  const hasAudio = streams.some((s) => s.codec_type === 'audio');

  let rotation = 0;
  for (const sd of v.side_data_list ?? []) {
    if (typeof sd.rotation === 'number') rotation = sd.rotation;
  }
  if (!rotation && v.tags?.rotate) rotation = Number(v.tags.rotate) || 0;
  // normalise 270 -> -90
  if (rotation === 270) rotation = -90;

  const swap = Math.abs(rotation) % 180 === 90;
  const width = v.width as number;
  const height = v.height as number;
  const range = v.color_range === 'pc' || v.color_range === 'jpeg' ? 'pc'
    : v.color_range === 'tv' || v.color_range === 'mpeg' ? 'tv'
    : /^yuvj/.test(v.pix_fmt ?? '') ? 'pc' : 'unknown';
  const duration = Number(j.format?.duration ?? v.duration ?? 0);

  return {
    duration,
    width,
    height,
    displayWidth: swap ? height : width,
    displayHeight: swap ? width : height,
    rotation,
    fps: rational(v.r_frame_rate),
    codec: v.codec_name ?? '',
    pixFmt: v.pix_fmt ?? '',
    colorRange: range,
    colorSpace: v.color_space ?? '',
    hasAudio,
  };
}
