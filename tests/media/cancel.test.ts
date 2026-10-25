import { describe, expect, it } from 'vitest';
import { run } from '../../lib/media/run';
import { withSignal } from '../../lib/media/cancel';

const sleeper = ['-e', 'setTimeout(() => {}, 30000)'];

describe('run() cancellation', () => {
  it('kills the process when the ambient signal aborts', async () => {
    const ac = new AbortController();
    const started = Date.now();
    const p = withSignal(ac.signal, () => run(process.execPath, sleeper));
    setTimeout(() => ac.abort(), 200);
    await expect(p).rejects.toThrow(/cancelled/);
    expect(Date.now() - started).toBeLessThan(5000);
  });

  it('refuses to start under an already-aborted signal', async () => {
    const ac = new AbortController();
    ac.abort();
    await expect(withSignal(ac.signal, () => run(process.execPath, ['-e', '1']))).rejects.toThrow(/cancelled/);
  });

  it('runs normally with no ambient signal', async () => {
    expect((await run(process.execPath, ['-e', 'process.stdout.write("ok")'])).stdout).toBe('ok');
  });
});
