import fs from 'node:fs/promises';
import { run } from '../media/run';
import type { Plan, Shot } from '../plan';
import { type CompileContext, type Fragment, num, tlFromTo } from './types';

/** Punch-in (reel doc §7.3): spring(damping 40, stiffness 120) × 0.08 is overdamped → smooth ease. */
const PUNCH = { scale: 1.08, duration: 1.2, ease: 'power2.out' };

export function allShots(plan: Plan): Shot[] {
  return plan.scenes.flatMap((s) => s.shots);
}

/** Footage: one muted `<video class="clip">` per shot inside a wrapper the punch-in scales. */
export function renderFootage(plan: Plan, ctx: CompileContext): Fragment {
  const html: string[] = [];
  const tl: string[] = [];
  allShots(plan).forEach((sh, i) => {
    const id = `shot-${i + 1}`;
    const dur = sh.to - sh.from;
    html.push(
      `<div id="${id}" class="shot">` +
        `<video id="${id}-video" class="clip" muted playsinline data-start="${num(sh.at)}" data-duration="${num(dur)}" ` +
        `data-media-start="${num(sh.from)}" data-track-index="0" src="${ctx.assetsUrl(sh.src)}"></video></div>`,
    );
    if (sh.punch !== undefined) {
      const end = sh.at + dur;
      const d = Math.min(PUNCH.duration, end - sh.punch);
      if (d > 0) tl.push(tlFromTo(`#${id}`, { scale: 1 }, { scale: PUNCH.scale, duration: d, ease: PUNCH.ease }, sh.punch));
    }
  });
  return {
    html: html.join('\n'),
    css: [
      '.shot { position: absolute; left: 0; top: 0; width: 100%; height: 100%; z-index: 1; overflow: hidden; }',
      '.shot video.clip { position: absolute; left: 0; top: 0; width: 100%; height: 100%; object-fit: cover; }',
    ].join('\n'),
    timeline: tl.join('\n'),
  };
}

function audioTag(id: string, a: Record<string, string>, src: string): string {
  const attrs = Object.entries(a)
    .map(([k, v]) => ` data-${k}="${v}"`)
    .join('');
  return `<audio id="${id}" class="clip"${attrs} src="${src}"></audio>`;
}

/** Voice-over spans the whole reel from 0. */
export function renderVoice(plan: Plan, ctx: CompileContext): string {
  if (!plan.voice) return '';
  return audioTag('voice', { start: '0', duration: num(plan.duration), volume: '1', 'track-index': '1' }, ctx.assetsUrl(plan.voice.src));
}

export function renderMusic(plan: Plan, ctx: CompileContext): string {
  const m = plan.music;
  if (!m) return '';
  return audioTag(
    'music',
    {
      start: '0',
      duration: num(plan.duration),
      'media-start': num(m.mediaStart),
      volume: num(m.volume),
      'fade-out': num(m.fadeOut),
      'track-index': '2',
    },
    ctx.assetsUrl(m.src),
  );
}

/** One `<audio>` per cue; `durations[i]` is the cue file's length in seconds. */
export function renderSfx(plan: Plan, ctx: CompileContext, durations: number[]): string {
  return plan.sfx
    .map((c, i) => {
      const d = Math.max(0.001, Math.min(durations[i], plan.duration - c.at));
      return audioTag(
        `sfx-${i + 1}`,
        { start: num(c.at), duration: num(d), volume: num(c.volume), 'track-index': String(10 + i) },
        ctx.assetsUrl(c.file),
      );
    })
    .join('\n');
}

/** Length of a PCM WAV from its header; other formats fall back to ffprobe. */
export async function audioDuration(file: string): Promise<number> {
  const buf = await fs.readFile(file);
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WAVE') {
    let off = 12;
    let byteRate = 0;
    while (off + 8 <= buf.length) {
      const idc = buf.toString('ascii', off, off + 4);
      const size = buf.readUInt32LE(off + 4);
      if (idc === 'fmt ') byteRate = buf.readUInt32LE(off + 16);
      if (idc === 'data' && byteRate > 0) return Math.min(size, buf.length - off - 8) / byteRate;
      off += 8 + size + (size % 2);
    }
  }
  const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]);
  const d = Number(stdout.trim());
  if (!Number.isFinite(d) || d <= 0) throw new Error(`cannot read duration of ${file}`);
  return d;
}
