import fs from 'node:fs/promises';
import path from 'node:path';
import { run } from '../media/run';
import { lumaStats } from '../media/prepare';
import { probe } from '../media/probe';

export interface QaExpect {
  fps: number;
  frames: number;
  width: number;
  height: number;
  lufs?: number;
  lumaRefs?: { src: string; srcT: number; outT: number }[];
}
export interface QaCheck { name: string; pass: boolean; detail: string }
export interface QaReport { pass: boolean; checks: QaCheck[] }

async function formatCheck(file: string, e: QaExpect): Promise<QaCheck> {
  const { stdout } = await run('ffprobe', [
    '-v', 'error', '-count_frames', '-select_streams', 'v:0', '-print_format', 'json', '-show_streams', file,
  ]);
  const v = JSON.parse(stdout).streams[0];
  const [n, d] = String(v.r_frame_rate).split('/').map(Number);
  const fps = d ? n / d : n;
  const frames = Number(v.nb_read_frames);
  const got = {
    fps: Number(fps.toFixed(3)), frames, w: v.width, h: v.height, range: v.color_range,
    primaries: v.color_primaries, space: v.color_space, trc: v.color_transfer, pix: v.pix_fmt,
  };
  const pass = Math.abs(fps - e.fps) < 0.01 && frames === e.frames && v.width === e.width && v.height === e.height
    && v.color_range === 'tv' && v.color_primaries === 'bt709' && v.color_space === 'bt709' && v.color_transfer === 'bt709'
    && v.pix_fmt === 'yuv420p';
  return { name: 'format', pass, detail: JSON.stringify(got) };
}

async function loudnessCheck(file: string, target: number): Promise<QaCheck> {
  const { stderr } = await run('ffmpeg', [
    '-hide_banner', '-nostats', '-i', file, '-vn',
    '-af', `loudnorm=I=${target}:TP=-1.5:LRA=11:print_format=json`, '-f', 'null', '-',
  ]);
  const m = stderr.match(/\{[^{}]*"input_i"[^{}]*\}/);
  if (!m) return { name: 'loudness', pass: false, detail: 'loudnorm output not found' };
  const j = JSON.parse(m[0]);
  const I = Number(j.input_i);
  const TP = Number(j.input_tp);
  const pass = Math.abs(I - target) <= 1 && TP <= -1.5;
  return { name: 'loudness', pass, detail: `I=${I} LUFS (target ${target} ±1), TP=${TP} dBTP (max -1.5)` };
}

async function lumaCheck(file: string, refs: NonNullable<QaExpect['lumaRefs']>, e: QaExpect): Promise<QaCheck> {
  const w = Math.round(e.width / 4);
  const h = Math.round(e.height / 4);
  const parts: string[] = [];
  let pass = true;
  for (const r of refs) {
    const a = await lumaStats(file, r.outT, w, h);
    const b = await lumaStats(r.src, r.srcT, w, h);
    const d = a.yavg - b.yavg;
    if (!(Math.abs(d) <= 3)) pass = false;
    parts.push(`t=${r.outT}: out=${a.yavg} ref=${b.yavg} d=${d.toFixed(3)}`);
  }
  return { name: 'luma', pass, detail: parts.join('; ') };
}

async function contactSheet(file: string): Promise<QaCheck> {
  const out = `${file}.sheet.jpg`;
  const rows = Math.max(1, Math.ceil(((await probe(file)).duration * 2) / 16));
  await run('ffmpeg', [
    '-y', '-v', 'error', '-i', file, '-an',
    '-vf', `fps=2,scale=135:-2,tile=16x${rows}`,
    '-frames:v', '1', '-q:v', '3', out,
  ]);
  return { name: 'contactSheet', pass: true, detail: out };
}

export async function qa(file: string, expect: QaExpect): Promise<QaReport> {
  const checks: QaCheck[] = [await formatCheck(file, expect)];
  if (expect.lufs !== undefined) checks.push(await loudnessCheck(file, expect.lufs));
  if (expect.lumaRefs?.length) checks.push(await lumaCheck(file, expect.lumaRefs, expect));
  checks.push(await contactSheet(file));
  return { pass: checks.every((c) => c.pass), checks };
}

export async function writeQa(dir: string, report: QaReport): Promise<void> {
  await fs.writeFile(path.join(dir, 'qa.json'), JSON.stringify(report, null, 2));
}
