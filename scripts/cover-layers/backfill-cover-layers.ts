/**
 * Backfill living-cover layers for the library (CLI wrapper).
 *
 * Thin wrapper over the shared `processLibraryCovers` runner. Idempotent +
 * resumable: covers already `ready` with a matching source-hash + pipeline
 * version are skipped (use `--force` to regenerate).
 *
 * Usage:
 *   bun run scripts/cover-layers/backfill-cover-layers.ts --library 1        # one library
 *   bun run scripts/cover-layers/backfill-cover-layers.ts --db               # every manga
 *   bun run scripts/cover-layers/backfill-cover-layers.ts --ids 4948,4946
 *   bun run scripts/cover-layers/backfill-cover-layers.ts --library 1 --force --concurrency 3
 *   bun run scripts/cover-layers/backfill-cover-layers.ts                     # cached cover files
 */

import fs from 'fs/promises';
import path from 'path';

import { processLibraryCovers } from '@/server/services/coverLayers/processLibrary';
import { logger } from '@/utils/logger';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const hasFlag = (name: string): boolean => process.argv.includes(`--${name}`);

function cacheBaseDir(): string {
  return process.env['MANGA_FILES_DIR'] ?? path.join(process.cwd(), 'data/cache');
}

/** Cover ids discovered from cached `manga-<id>.<ext>` files (legacy file-based mode). */
async function discoverCoverIds(): Promise<number[]> {
  const dir = path.join(cacheBaseDir(), 'covers');
  const entries = await fs.readdir(dir).catch(() => [] as string[]);
  const ids = new Set<number>();
  for (const name of entries) {
    const match = /^manga-(\d+)\.[a-z0-9]+$/i.exec(name);
    if (match?.[1] !== undefined) {
      ids.add(Number(match[1]));
    }
  }
  return [...ids].sort((a, b) => a - b);
}

async function main(): Promise<void> {
  const idsArg = arg('ids');
  const libraryArg = arg('library');
  const limit = arg('limit') !== undefined ? Number(arg('limit')) : undefined;
  const concurrency = arg('concurrency') !== undefined ? Number(arg('concurrency')) : 2;
  const force = hasFlag('force');

  let ids: number[] | undefined;
  let libraryId: number | undefined;
  if (idsArg !== undefined) {
    ids = idsArg.split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n));
  } else if (libraryArg !== undefined) {
    libraryId = Number(libraryArg);
  } else if (!hasFlag('db')) {
    ids = await discoverCoverIds();
  }
  if (ids !== undefined && limit !== undefined) {
    ids = ids.slice(0, limit);
  }

  logger.info(`[backfill] starting (concurrency=${concurrency}, force=${force})`);
  const result = await processLibraryCovers({ ids, libraryId, force, concurrency });
  logger.info(
    `[backfill] done — layered=${result.layered} flat=${result.flat} skipped=${result.skipped} failed=${result.failed} (of ${result.total})`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    logger.error('[backfill] fatal', { error: err instanceof Error ? err.message : String(err) });
    process.exit(1);
  });
