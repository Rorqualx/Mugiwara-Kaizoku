/**
 * Backfill living-cover layers for the library.
 *
 * Finds every cached cover (data/cache/covers/manga-<id>.<ext>) and runs the
 * layerizer for each. Idempotent + resumable: covers already `ready` with a
 * matching source-hash + pipeline version are skipped, so re-running only
 * processes new/changed covers (no separate checkpoint file needed).
 *
 * Usage:
 *   bun run scripts/cover-layers/backfill-cover-layers.ts            # whole library
 *   bun run scripts/cover-layers/backfill-cover-layers.ts --ids 470,469
 *   bun run scripts/cover-layers/backfill-cover-layers.ts --limit 50 --force
 *   bun run scripts/cover-layers/backfill-cover-layers.ts --concurrency 3
 */

import fs from 'fs/promises';
import path from 'path';

import { layerizeCover } from '@/server/services/coverLayers/coverLayerizer';
import { logger } from '@/utils/logger';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const hasFlag = (name: string): boolean => process.argv.includes(`--${name}`);

function cacheBaseDir(): string {
  return process.env['MANGA_FILES_DIR'] ?? path.join(process.cwd(), 'data/cache');
}

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

async function runPool(ids: number[], force: boolean, concurrency: number): Promise<void> {
  const counts: Record<string, number> = { layered: 0, flat: 0, skipped: 0, failed: 0 };
  let cursor = 0;
  async function worker(): Promise<void> {
    while (cursor < ids.length) {
      const id = ids[cursor++];
      if (id === undefined) {
        return;
      }
      const result = await layerizeCover(id, force);
      counts[result.status] = (counts[result.status] ?? 0) + 1;
      logger.info(`[backfill] manga ${id}: ${result.status}${result.reason ? ` (${result.reason})` : ''}${result.error ? ` — ${result.error}` : ''}`);
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, () => worker()));
  logger.info(`[backfill] done — layered=${counts['layered']} flat=${counts['flat']} skipped=${counts['skipped']} failed=${counts['failed']}`);
}

async function main(): Promise<void> {
  const idsArg = arg('ids');
  const limit = arg('limit') !== undefined ? Number(arg('limit')) : undefined;
  const concurrency = arg('concurrency') !== undefined ? Number(arg('concurrency')) : 2;
  const force = hasFlag('force');

  let ids = idsArg !== undefined ? idsArg.split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n)) : await discoverCoverIds();
  if (limit !== undefined) {
    ids = ids.slice(0, limit);
  }
  logger.info(`[backfill] processing ${ids.length} cover(s) (concurrency=${concurrency}, force=${force})`);
  await runPool(ids, force, concurrency);
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    logger.error('[backfill] fatal', { error: err instanceof Error ? err.message : String(err) });
    process.exit(1);
  });
