import { fileResponse } from '@/lib/app/http/file-response';
import { projectDir } from '@/lib/app/workspace/paths';

type Ctx = { params: Promise<{ id: string; path: string[] }> };

/** Renders (versions/) and the user's media (inputs/) for the Review players; nothing else of the project. */
export async function GET(req: Request, { params }: Ctx) {
  const { id, path: parts } = await params;
  if (!['versions', 'inputs'].includes(parts[0] ?? '')) return new Response('not found', { status: 404 });
  return fileResponse(projectDir(id), parts.map(encodeURIComponent).join('/'), req);
}
