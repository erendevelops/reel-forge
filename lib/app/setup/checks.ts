import { mkdir, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { t, type Language } from '@/lib/i18n';
import { checkAvailability } from '@/lib/app/claude/availability';
import { run } from '@/lib/media/run';
import { npx } from '@/lib/media/npx';

export type CheckId = 'node' | 'claude' | 'ffmpeg' | 'python' | 'whisper' | 'mediapipe' | 'face-model' | 'chrome';
export type Check = { id: CheckId; ok: boolean; detail: string; fix: string | null };

export const FACE_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';
export const FACE_MODEL_PATH = path.join(process.cwd(), 'tools', 'models', 'blaze_face_short_range.tflite');
const MIN_MODEL_BYTES = 100_000;

const mac = process.platform === 'darwin';
const FIX: Record<Exclude<CheckId, 'face-model'>, string> = {
  node: mac ? 'brew install node' : 'winget install OpenJS.NodeJS.LTS',
  claude: 'npm install -g @anthropic-ai/claude-code   →   claude',
  ffmpeg: mac ? 'brew install ffmpeg' : 'winget install Gyan.FFmpeg',
  python: mac ? 'brew install python@3.12' : 'winget install Python.Python.3.12',
  whisper: 'python -m pip install --user faster-whisper numpy',
  mediapipe: 'python -m pip install --user mediapipe',
  chrome: 'npx hyperframes@0.8.191 browser install',
};

async function tryRun(cmd: string, args: string[]): Promise<string | null> {
  try {
    const r = await run(cmd, args, { timeoutMs: 60_000, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
    return `${r.stdout}${r.stderr}`.trim();
  } catch {
    return null;
  }
}

export async function checkNode(lang: Language): Promise<Check> {
  const major = Number(process.versions.node.split('.')[0]);
  const ok = major >= 20;
  return { id: 'node', ok, detail: ok ? `v${process.versions.node}` : `v${process.versions.node} — ${t(lang).setup.tooOld}`, fix: ok ? null : FIX.node };
}

export async function checkClaude(binary: string, lang: Language): Promise<Check> {
  const a = await checkAvailability(binary, lang);
  return { id: 'claude', ok: a.status === 'ok', detail: a.detail, fix: a.status === 'ok' ? null : a.status === 'missing' ? FIX.claude : 'claude' };
}

export async function checkFfmpeg(lang: Language): Promise<Check> {
  const [ff, fp] = await Promise.all([tryRun('ffmpeg', ['-version']), tryRun('ffprobe', ['-version'])]);
  const ok = ff !== null && fp !== null;
  return { id: 'ffmpeg', ok, detail: ok ? ff!.split('\n')[0] : t(lang).setup.missing, fix: ok ? null : FIX.ffmpeg };
}

async function python(args: string[]): Promise<string | null> {
  return (await tryRun('python', args)) ?? (await tryRun('python3', args));
}

export async function checkPython(lang: Language): Promise<Check> {
  const out = await python(['-c', 'import sys; print("%d.%d.%d" % sys.version_info[:3])']);
  const [maj, min] = (out ?? '0.0').split('.').map(Number);
  const ok = out !== null && (maj > 3 || (maj === 3 && min >= 10));
  return { id: 'python', ok, detail: out ? `Python ${out}${ok ? '' : ` — ${t(lang).setup.tooOld}`}` : t(lang).setup.missing, fix: ok ? null : FIX.python };
}

async function checkImport(id: 'whisper' | 'mediapipe', mod: string, lang: Language): Promise<Check> {
  const code = `import sys; print(sys.executable)\ntry:\n    import ${mod}; print("OK", getattr(${mod}, "__version__", ""))\nexcept Exception as e:\n    print("ERR", type(e).__name__, e)`;
  const out = await python(['-c', code]);
  const lines = (out ?? '').split('\n').map((l) => l.trim());
  const okLine = lines.find((l) => l.startsWith('OK'));
  // on failure show which python ran and Python's own error, so a wrong interpreter or a broken install is visible
  const why = lines.find((l) => l.startsWith('ERR'))?.slice(4) ?? t(lang).setup.missing;
  return { id, ok: !!okLine, detail: okLine ? `${mod} ${okLine.slice(3)}` : `${why} (${lines[0] || 'python'})`, fix: okLine ? null : FIX[id] };
}

export async function checkFaceModel(file: string, lang: Language): Promise<Check> {
  const size = await stat(file).then((s) => s.size).catch(() => 0);
  const ok = size >= MIN_MODEL_BYTES;
  return { id: 'face-model', ok, detail: ok ? `${Math.round(size / 1024)} KB` : t(lang).setup.modelMissing, fix: ok ? null : 'download' };
}

export async function checkChrome(lang: Language): Promise<Check> {
  const [cmd, args] = npx(['-y', 'hyperframes@0.8.191', 'doctor']);
  const out = await tryRun(cmd, args);
  const ok = out !== null && /chrom/i.test(out) && !/chrome[^\n]*(missing|not found)/i.test(out);
  return { id: 'chrome', ok, detail: ok ? 'Chrome' : t(lang).setup.missing, fix: ok ? null : FIX.chrome };
}

export async function runChecks(o: { lang: Language; claudeBinary: string; faceModel?: string }): Promise<Check[]> {
  return Promise.all([
    checkNode(o.lang),
    checkClaude(o.claudeBinary, o.lang),
    checkFfmpeg(o.lang),
    checkPython(o.lang),
    checkImport('whisper', 'faster_whisper', o.lang),
    checkImport('mediapipe', 'mediapipe', o.lang),
    checkFaceModel(o.faceModel ?? FACE_MODEL_PATH, o.lang),
    checkChrome(o.lang),
  ]);
}

/** Downloads the MediaPipe face model. Only called from the user's click on the Setup page (their consent). */
export async function downloadFaceModel(file = FACE_MODEL_PATH): Promise<void> {
  const res = await fetch(FACE_MODEL_URL);
  if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length < MIN_MODEL_BYTES) throw new Error(`download too small: ${bytes.length} bytes`);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(`${file}.tmp`, bytes);
  await rename(`${file}.tmp`, file);
}
