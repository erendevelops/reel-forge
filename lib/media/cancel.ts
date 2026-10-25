import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * The abort signal of the job a piece of work belongs to. Every `run()` inside `withSignal` is killed when the signal
 * aborts, so a long render (ffmpeg, HyperFrames) is cancellable without threading a signal through every call.
 */
const ambient = new AsyncLocalStorage<AbortSignal>();

export function withSignal<T>(signal: AbortSignal | undefined, fn: () => Promise<T>): Promise<T> {
  return signal ? ambient.run(signal, fn) : fn();
}

export function currentSignal(): AbortSignal | undefined {
  return ambient.getStore();
}
