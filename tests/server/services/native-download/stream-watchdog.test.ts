/**
 * @jest-environment node
 */
import { PassThrough, Readable } from 'stream';
import { pipeline } from 'stream/promises';

import { createIdleWatchdog } from '@/server/services/native-download/downloaders/stream-watchdog';

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe('createIdleWatchdog', () => {
  it('resolves cleanly when bytes flow through the observer', async () => {
    const watchdog = createIdleWatchdog(500);
    const sink = new PassThrough();

    const drained = new Promise<Buffer[]>((resolve, reject) => {
      const chunks: Buffer[] = [];
      sink.on('data', (chunk: Buffer) => chunks.push(chunk));
      sink.on('end', () => resolve(chunks));
      sink.on('error', reject);
    });

    const source = Readable.from(['hello ', 'world']);
    await pipeline(source, watchdog.observer, sink, { signal: watchdog.signal });
    watchdog.dispose();

    const buffers = await drained;
    expect(Buffer.concat(buffers).toString()).toBe('hello world');
    expect(watchdog.signal.aborted).toBe(false);
  });

  it('aborts when no data flows for idleMs', async () => {
    const watchdog = createIdleWatchdog(50);
    const stalled = new PassThrough();
    const sink = new PassThrough();
    sink.resume();

    const caught = pipeline(stalled, watchdog.observer, sink, {
      signal: watchdog.signal,
    }).then(() => null).catch((e: unknown) => e);

    await wait(150);

    const err = await caught;
    expect(err).toBeTruthy();
    expect(watchdog.signal.aborted).toBe(true);
    expect(watchdog.signal.reason).toBeInstanceOf(Error);
    expect((watchdog.signal.reason as Error).message).toBe('Stream idle for 50ms');
    watchdog.dispose();
  });

  it('propagates abort from parent signal', () => {
    const parent = new AbortController();
    const watchdog = createIdleWatchdog(60_000, parent.signal);

    expect(watchdog.signal.aborted).toBe(false);
    parent.abort(new Error('Parent cancelled'));

    expect(watchdog.signal.aborted).toBe(true);
    expect((watchdog.signal.reason as Error).message).toBe('Parent cancelled');
    watchdog.dispose();
  });

  it('fires immediately when parent signal is already aborted', () => {
    const parent = new AbortController();
    parent.abort(new Error('Pre-aborted'));

    const watchdog = createIdleWatchdog(60_000, parent.signal);

    expect(watchdog.signal.aborted).toBe(true);
    expect((watchdog.signal.reason as Error).message).toBe('Pre-aborted');
    watchdog.dispose();
  });

  it('dispose clears the timer so no abort fires after success', async () => {
    const watchdog = createIdleWatchdog(50);
    watchdog.observer.write('x');
    watchdog.dispose();

    await wait(150);

    expect(watchdog.signal.aborted).toBe(false);
  });
});
