/**
 * Batch insert of new provider chapters during the enrichment chapter merge.
 */

import { logger } from '@/utils/logger';

import type { Prisma } from '@prisma/client';

const INSERT_BATCH_SIZE = 50;

/** Rows a `createMany({ skipDuplicates: true })` silently dropped. */
export function countSkippedInserts(attempted: number, inserted: number): number {
  return Math.max(0, attempted - inserted);
}

/**
 * Insert new chapter rows and return how many actually landed.
 * `skipDuplicates` drops a row when a concurrent writer (scan, import) took
 * its (mangaId, index) or (mangaId, chapterNumber) after our snapshot read.
 */
export async function insertNewChapters(
  tx: Prisma.TransactionClient,
  mangaId: number,
  records: Prisma.ChapterCreateManyInput[],
): Promise<number> {
  let created = 0;
  for (let i = 0; i < records.length; i += INSERT_BATCH_SIZE) {
    // eslint-disable-next-line no-await-in-loop -- sequential batch inserts within transaction
    const batch = await tx.chapter.createMany({ data: records.slice(i, i + INSERT_BATCH_SIZE), skipDuplicates: true });
    created += batch.count;
  }
  const skipped = countSkippedInserts(records.length, created);
  if (skipped > 0) {
    logger.warn(`[enrichmentPipeline] ${skipped} of ${records.length} provider chapter(s) for manga ${mangaId} were not inserted (unique conflict with a concurrent writer)`);
  }
  return created;
}
