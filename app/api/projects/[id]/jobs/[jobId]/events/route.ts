import { subscribe, type JobEvent } from '@/lib/app/jobs/jobs';

type Ctx = { params: Promise<{ id: string; jobId: string }> };

export const dynamic = 'force-dynamic';

/**
 * Server-Sent Events: replays the job log, then streams until a terminal state. The browser may go away at any
 * moment (reload, leaving the page): from then on nothing is written to the stream.
 */
export async function GET(req: Request, { params }: Ctx) {
  const { id, jobId } = await params;
  const encoder = new TextEncoder();
  let closed = false;
  let off = () => {};
  const stop = () => {
    if (closed) return false;
    closed = true;
    off();
    return true;
  };
  const stream = new ReadableStream({
    start(controller) {
      const close = () => {
        if (!stop()) return;
        try {
          controller.close();
        } catch {
          /* already closed by the browser */
        }
      };
      off = subscribe(id, jobId, (e: JobEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
        } catch {
          stop(); // the browser closed the connection
          return;
        }
        if (e.type === 'state' && e.state !== 'running') queueMicrotask(close);
      });
      if (closed) off(); // a terminal replay finished before `off` was assigned
      req.signal.addEventListener('abort', close);
    },
    cancel() {
      stop();
    },
  });
  return new Response(stream, {
    headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache, no-transform', connection: 'keep-alive' },
  });
}
