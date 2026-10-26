import path from 'node:path';
import { fileResponse } from '@/lib/app/http/file-response';
import { projectDir } from '@/lib/app/workspace/paths';

type Ctx = { params: Promise<{ id: string; path: string[] }> };

/** The compiled preview pages and their assets, from `<project>/.preview/` only. */
export async function GET(req: Request, { params }: Ctx) {
  const { id, path: parts } = await params;
  return fileResponse(path.join(projectDir(id), '.preview'), parts.map(encodeURIComponent).join('/'), req);
}
