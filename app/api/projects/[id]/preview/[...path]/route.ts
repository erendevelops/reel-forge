import path from 'node:path';
import { fileResponse } from '@/lib/app/http/file-response';
import { projectDir } from '@/lib/app/workspace/paths';

type Ctx = { params: Promise<{ id: string; path: string[] }> };

/**
 * The compiled preview pages and their assets, from `<project>/.preview/` only. Pages carry a sandbox CSP: they
 * run Claude-authored scene scripts, which must never get the app's origin (and with it the app's API), even when
 * the page is opened in a tab of its own.
 */
export async function GET(req: Request, { params }: Ctx) {
  const { id, path: parts } = await params;
  const html = /\.html?$/i.test(parts.at(-1) ?? '');
  // the sandboxed page has the opaque origin "null"; fonts load in CORS mode, so they need it allowed
  const headers: Record<string, string> = { 'access-control-allow-origin': 'null' };
  if (html) headers['content-security-policy'] = 'sandbox allow-scripts';
  return fileResponse(path.join(projectDir(id), '.preview'), parts.map(encodeURIComponent).join('/'), req, headers);
}
