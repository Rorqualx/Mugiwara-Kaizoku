/**
 * Library cover-layer processing
 *
 * Shared bounded worker-pool runner used by both the CLI backfill script
 * (`scripts/cover-layers/backfill-cover-layers.ts`) and the `coverLayers` tRPC
 * trigger. Only one run happens at a time; a module-level snapshot exposes live
 * progress so the status endpoint can report it while a run is in flight.
 */

import { prisma } from '@/server/db';
import { layerizeCover, type LayerizeResult } from '@/server/services/coverLayers/coverLayerizer';
import { logger } from '@/utils/logger';

/** Live snapshot of the current (or last) processing run. */
export interface ProcessProgress {
  running: boolean;
  total: number;
  processed: number;
  layered: number;
  flat: number;
  skipped: number;
  failed: number;
  startedAt: number | null;
}

const state: ProcessProgress = {
  running: false,
  total: 0,
  processed: 0,
  layered: 0,
  flat: 0,
  skipped: 0,
  failed: 0,
  startedAt: null,
};

/** Whether a processing run is currently in flight. */
export function isProcessing(): boolean {
  return state.running;
}

/** A copy of the current processing-run progress snapshot. */
export function processProgress(): ProcessProgress {
  return { ...state };
}

/** Options for {@link processLibraryCovers}. */
export interface ProcessOptions {
  libraryId?: number | undefined;
  ids?: number[] | undefined;
  force?: boolean | undefined;
  concurrency?: number | undefined;
}

async function discoverIds(opts: ProcessOptions): Promise<number[]> {
  if (opts.ids !== undefined && opts.ids.length > 0) {
    return opts.ids;
  }
  const rows = await prisma.manga.findMany({
    where: opts.libraryId !== undefined ? { libraryId: opts.libraryId } : {},
    select: { id: true },
    orderBy: { id: 'asc' },
  });
  return rows.map((r) => r.id);
}

function record(result: LayerizeResult): void {
  state.processed += 1;
  if (result.status === 'layered') {
    state.layered += 1;
  } else if (result.status === 'flat') {
    state.flat += 1;
  } else if (result.status === 'skipped') {
    state.skipped += 1;
  } else {
    state.failed += 1;
  }
}

/**
 * Layerizes every manga cover with bounded concurrency. Refuses to start a
 * second concurrent run (returns the in-flight snapshot instead). Idempotent:
 * fresh covers are skipped unless `force` is set.
 *
 * @param opts - Scope (libraryId/ids), force re-run, and concurrency.
 * @returns The final progress snapshot.
 */
export async function processLibraryCovers(opts: ProcessOptions = {}): Promise<ProcessProgress> {
  if (state.running) {
    return processProgress();
  }
  const ids = await discoverIds(opts);
  state.running = true;
  state.total = ids.length;
  state.processed = 0;
  state.layered = 0;
  state.flat = 0;
  state.skipped = 0;
  state.failed = 0;
  state.startedAt = Date.now();

  const concurrency = Math.max(1, opts.concurrency ?? 2);
  const force = opts.force ?? false;
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < ids.length) {
      const id = ids[cursor];
      cursor += 1;
      if (id === undefined) {
        return;
      }
      try {
        // Sequential within a worker is intentional — parallelism comes from
        // running `concurrency` workers; layerize is CPU-heavy so we don't want
        // one worker firing many at once.
        // eslint-disable-next-line no-await-in-loop
        record(await layerizeCover(id, force));
      } catch (err: unknown) {
        state.processed += 1;
        state.failed += 1;
        logger.warn('[cover-layers] manga failed', { id, error: err instanceof Error ? err.message : String(err) });
      }
    }
  }

  try {
    await Promise.all(Array.from({ length: concurrency }, () => worker()));
  } finally {
    state.running = false;
  }
  logger.info('[cover-layers] processLibrary done', {
    total: state.total,
    layered: state.layered,
    flat: state.flat,
    skipped: state.skipped,
    failed: state.failed,
  });
  return processProgress();
}
