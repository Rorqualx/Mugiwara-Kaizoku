/**
 * Compute Missing Chapters Procedure
 *
 * For each (mangaId, files[]) pair from the import-pipeline scan, parses
 * chapter/volume numbers from the file names and compares against the
 * library's existing Chapter rows. Returns `newChapters` — the number of
 * incoming chapter/volume signatures not yet present in the library.
 *
 * Used by the Detect/Match UI to (a) show a "+N new" badge on IN_LIBRARY
 * rows and (b) hide rows where the on-disk content adds nothing new.
 *
 * @module server/trpc/routers/library/compute-missing-chapters
 */
import path from 'path';

import { z } from 'zod';

import { prisma } from '@/server/db';
import { parseChapterFileName } from '@/server/services/packImport/file-scanner';
import { protectedProcedure } from '@/server/trpc/procedures';
import { logger } from '@/utils/logger';

const fileShape = z.object({
  name: z.string(),
  path: z.string(),
});

export const computeMissingChaptersSchema = z.object({
  items: z.array(z.object({
    mangaId: z.number(),
    files: z.array(fileShape),
  })).max(2000),
});

export type ComputeMissingChaptersInput = z.infer<typeof computeMissingChaptersSchema>;

export interface MissingChaptersResult {
  mangaId: number;
  newChapters: number;
  totalIncoming: number;
  existingChapters: number;
}

export interface ComputeMissingChaptersOutput {
  results: MissingChaptersResult[];
}

/**
 * Build a "coverage signature set" for the manga: every chapter row contributes
 * `ch:<n>` and `vol:<n>` (whichever is non-null), so an incoming file matching
 * either dimension counts as already covered.
 */
function coverageSet(rows: Array<{ chapterNumber: number | null; volume: number | null }>): Set<string> {
  const out = new Set<string>();
  for (const r of rows) {
    if (typeof r.chapterNumber === 'number') out.add(`ch:${r.chapterNumber}`);
    if (typeof r.volume === 'number') out.add(`vol:${r.volume}`);
  }
  return out;
}

/**
 * Signature for an incoming file. Prefer chapterNumber when present (more
 * specific); fall back to volume; finally fall back to the basename so a
 * file with no parseable number still gets counted (won't dedupe across
 * different unparseable filenames).
 */
function fileSignature(name: string): string {
  const ext = path.extname(name);
  const parsed = parseChapterFileName(name, ext);
  if (typeof parsed.chapterNumber === 'number') return `ch:${parsed.chapterNumber}`;
  if (typeof parsed.volumeNumber === 'number') return `vol:${parsed.volumeNumber}`;
  return `raw:${path.basename(name, ext).toLowerCase()}`;
}

async function computeForItem(item: ComputeMissingChaptersInput['items'][number]): Promise<MissingChaptersResult> {
  const rows = await prisma.chapter.findMany({
    where: { mangaId: item.mangaId },
    select: { chapterNumber: true, volume: true },
  });
  const covered = coverageSet(rows);

  const incoming = new Set<string>();
  for (const f of item.files) incoming.add(fileSignature(f.name));

  let newCount = 0;
  for (const sig of incoming) {
    if (!covered.has(sig)) newCount++;
  }

  return {
    mangaId: item.mangaId,
    newChapters: newCount,
    totalIncoming: incoming.size,
    existingChapters: rows.length,
  };
}

export const computeMissingChaptersProcedure = protectedProcedure
  .input(computeMissingChaptersSchema)
  .query(async ({ input }): Promise<ComputeMissingChaptersOutput> => {
    if (input.items.length === 0) return { results: [] };
    const results = await Promise.all(input.items.map(computeForItem));
    logger.info('computeMissingChapters', {
      items: input.items.length,
      withNew: results.filter((r) => r.newChapters > 0).length,
    });
    return { results };
  });
