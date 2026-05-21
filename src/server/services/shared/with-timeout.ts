import { logger } from '@/utils/logger';

/**
 * Race a promise against a timeout. On timeout, log a warning and resolve
 * to null (never throws). Callers branch on null the same way they branch
 * on any other missing-provider-data case.
 *
 * Does NOT cancel the underlying work — it only stops awaiting. The inner
 * promise continues to run and its result (success or failure) is
 * discarded once the timeout fires.
 */
export async function withTimeoutOrNull<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T | null> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) => {
        timer = setTimeout(() => {
          logger.warn(`[timeout] ${label} exceeded ${timeoutMs}ms — returning null`);
          resolve(null);
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
