/**
 * Enrichment Pipeline Mutex
 *
 * Prevents concurrent enrichment of the same manga.
 * Uses an in-memory lock map with promise-based waiting.
 */

import { logger } from '@/utils/logger';

/** Map<mangaId, Promise<void>> — active enrichment locks */
const activeLocks = new Map<number, Promise<void>>();

/**
 * Execute a function with an exclusive lock on a manga ID.
 * If another enrichment is running for the same manga, waits for it to finish first.
 */
export async function withEnrichmentLock<T>(
  mangaId: number,
  fn: () => Promise<T>,
): Promise<T> {
  // Wait for any existing lock on this mangaId (spinlock pattern)
  while (activeLocks.has(mangaId)) {
    logger.info(`[enrichmentLock] Waiting for existing enrichment lock on manga ${mangaId}`);
    await activeLocks.get(mangaId); // eslint-disable-line no-await-in-loop -- Intentional: spinlock pattern
  }

  // Set our lock with a resolver to signal completion
  let resolve: (() => void) | undefined;
  const lockPromise = new Promise<void>((r) => {
    resolve = r;
  });
  activeLocks.set(mangaId, lockPromise);

  try {
    return await fn();
  } finally {
    activeLocks.delete(mangaId);
    if (resolve) resolve();
  }
}
