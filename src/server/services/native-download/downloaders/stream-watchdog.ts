import { PassThrough } from 'stream';

export interface IdleWatchdog {
  signal: AbortSignal;
  observer: PassThrough;
  dispose(): void;
}

export function createIdleWatchdog(idleMs: number, parentSignal?: AbortSignal): IdleWatchdog {
  const controller = new AbortController();
  const observer = new PassThrough();
  let timer: NodeJS.Timeout | undefined;

  const reset = (): void => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      controller.abort(new Error(`Stream idle for ${idleMs}ms`));
    }, idleMs);
  };

  const onParentAbort = (): void => {
    const reason = parentSignal?.reason instanceof Error
      ? parentSignal.reason
      : new Error('Aborted by parent signal');
    controller.abort(reason);
  };

  if (parentSignal?.aborted) {
    onParentAbort();
  } else {
    parentSignal?.addEventListener('abort', onParentAbort, { once: true });
  }

  observer.on('data', reset);
  reset();

  return {
    signal: controller.signal,
    observer,
    dispose: (): void => {
      if (timer) clearTimeout(timer);
      observer.off('data', reset);
      parentSignal?.removeEventListener('abort', onParentAbort);
    },
  };
}
