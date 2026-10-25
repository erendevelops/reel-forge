import { subscribe, type JobEvent } from '@/lib/app/jobs/jobs';

type Ctx = { params: Promise<{ id: string; jobId: string }> };

export const dynamic = 'force-dynamic';

/** Server-Sent Events: replays the job log, then streams until a terminal state. */
export async function GET(req: Request, { params }: Ctx) {
  const { id, jobId } = await params;
  const encoder = new TextEncoder();
  let off = () => {};
  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      const close = () => {
        if (closed) return;
        closed = true;
        off();
        controller.close();
      };
      off = subscribe(id, jobId, (e: JobEvent) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
        if (e.type === 'state' && e.state !== 'running') queueMicrotask(close);
      });
      req.signal.addEventListener('abort', close);
    },
    cancel() {
      off();
    },
  });
  return new Response(stream, {
    headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache, no-transform', connection: 'keep-alive' },
  });
}
