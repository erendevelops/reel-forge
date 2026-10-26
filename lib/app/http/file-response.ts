import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.flac': 'audio/flac',
};

const notFound = () => new Response('not found', { status: 404 });

/** `rel` (URL-encoded, `/`-separated) resolved under `root`, or null if it would leave it. */
function resolveUnder(root: string, rel: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(rel);
  } catch {
    return null;
  }
  const parts = decoded.split(/[\\/]+/).filter(Boolean);
  if (!parts.length || parts.some((p) => p === '..' || p === '.' || /^[a-zA-Z]:$/.test(p)) || /^[\\/]/.test(decoded)) return null;
  const base = path.resolve(root);
  const file = path.resolve(base, ...parts);
  return file.startsWith(base + path.sep) ? file : null;
}

/**
 * A file under `root` as an HTTP response: MIME type from the extension and `Range: bytes=a-b` support (206 / 416),
 * which video seeking needs. Anything outside `root` (`..`, absolute paths, drive letters, encoded traversal) is 404.
 */
export async function fileResponse(root: string, rel: string, req: Request, extra: Record<string, string> = {}): Promise<Response> {
  const file = resolveUnder(root, rel);
  if (!file) return notFound();
  const info = await stat(file).catch(() => null);
  if (!info?.isFile()) return notFound();
  const size = info.size;
  const headers: Record<string, string> = {
    'content-type': TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
    'accept-ranges': 'bytes',
    'cache-control': 'no-store',
    ...extra,
  };
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get('range') ?? '');
  if (range && (range[1] || range[2])) {
    let start = range[1] ? Number(range[1]) : size - Number(range[2]);
    let end = range[1] && range[2] ? Number(range[2]) : size - 1;
    if (!range[1]) start = Math.max(0, start);
    end = Math.min(end, size - 1);
    if (start >= size || start > end) return new Response(null, { status: 416, headers: { 'content-range': `bytes */${size}` } });
    const body = Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream;
    return new Response(body, { status: 206, headers: { ...headers, 'content-range': `bytes ${start}-${end}/${size}`, 'content-length': String(end - start + 1) } });
  }
  const body = Readable.toWeb(createReadStream(file)) as ReadableStream;
  return new Response(body, { status: 200, headers: { ...headers, 'content-length': String(size) } });
}
