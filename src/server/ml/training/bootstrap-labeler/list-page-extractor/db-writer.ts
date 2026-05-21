/**
 * Database Writer for List Page Records
 *
 * Persists extracted list page data to the database for ML training.
 * Handles upsert logic for reprocessing existing pages.
 */

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

import type { ChapterExtraction, ListPageExtractionResult, ListPageWriteResult, VolumeExtraction } from './types';

// ============================================================================
// Main Writer Function
// ============================================================================

/**
 * Write list page extraction results to the database
 */
export async function writeListPageToDatabase(
  annotatedPageId: string,
  result: ListPageExtractionResult
): Promise<ListPageWriteResult> {
  logger.info('Writing list page to database', {
    annotatedPageId,
    volumeCount: result.volumes.length,
    chapterCount: result.chapters.length,
    relationCount: result.relations.length,
  });

  // Use transaction for atomicity
  return prisma.$transaction(async (tx) => {
    // Delete existing records if reprocessing
    await deleteExistingRecords(tx, annotatedPageId);

    // Create list page record
    const listPageRecord = await tx.listPageRecord.create({
      data: {
        annotatedPageId,
        tableCount: result.stats.tableCount,
        volumeCount: result.stats.volumeCount,
        chapterCount: result.stats.chapterCount,
        validationStatus: 'UNVALIDATED',
      },
    });

    // Create volume records
    const volumeIdMap = await createVolumeRecords(tx, listPageRecord.id, result.volumes);

    // Create chapter records with volume relationships
    const chaptersCreated = await createChapterRecords(tx, listPageRecord.id, result.chapters, volumeIdMap);

    logger.info('List page written to database', {
      listPageId: listPageRecord.id,
      volumesCreated: volumeIdMap.size,
      chaptersCreated,
    });

    return {
      listPageId: listPageRecord.id,
      volumesCreated: volumeIdMap.size,
      chaptersCreated,
      relationsCreated: result.relations.length,
    };
  });
}

// ============================================================================
// Helper Functions
// ============================================================================

type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Delete existing list page records for reprocessing
 */
async function deleteExistingRecords(tx: TransactionClient, annotatedPageId: string): Promise<void> {
  const existing = await tx.listPageRecord.findUnique({
    where: { annotatedPageId },
  });

  if (existing) {
    // Cascade delete will handle volume and chapter records
    await tx.listPageRecord.delete({
      where: { id: existing.id },
    });

    logger.debug('Deleted existing list page record', { listPageId: existing.id });
  }
}

/**
 * Create volume records and return a map of volumeNumber -> recordId
 */
async function createVolumeRecords(
  tx: TransactionClient,
  listPageId: string,
  volumes: VolumeExtraction[]
): Promise<Map<number, string>> {
  const records = await Promise.all(
    volumes.map((volume) =>
      tx.volumeListRecord.create({
        data: {
          listPageId,
          volumeNumber: volume.volumeNumber,
          volumeTitle: volume.title ?? null,
          numberTokenIndex: volume.tokenSpans.number?.start ?? null,
          titleTokenStart: volume.tokenSpans.title?.start ?? null,
          titleTokenEnd: volume.tokenSpans.title?.end ?? null,
          volumeUrl: volume.url ?? null,
          coverImageUrl: volume.coverUrl ?? null,
          isbn: volume.isbn ?? null,
          releaseDate: volume.releaseDate ?? null,
          chapterStart: volume.chapterStart ?? null,
          chapterEnd: volume.chapterEnd ?? null,
          tableId: volume.tableId,
          tableRow: volume.tableRow,
          confidence: volume.confidence,
        },
      }).then((record) => ({ volumeNumber: volume.volumeNumber, id: record.id }))
    )
  );

  const volumeIdMap = new Map<number, string>();
  for (const { volumeNumber, id } of records) {
    volumeIdMap.set(volumeNumber, id);
  }
  return volumeIdMap;
}

/**
 * Create chapter records with volume relationships
 */
async function createChapterRecords(
  tx: TransactionClient,
  listPageId: string,
  chapters: ChapterExtraction[],
  volumeIdMap: Map<number, string>
): Promise<number> {
  await Promise.all(
    chapters.map((chapter) => {
      // Look up volume record ID if chapter has a volume assignment
      const volumeRecordId = chapter.belongsToVolume !== undefined
        ? volumeIdMap.get(chapter.belongsToVolume) ?? null
        : null;

      return tx.chapterListRecord.create({
        data: {
          listPageId,
          volumeRecordId,
          volumeNumber: chapter.belongsToVolume ?? null,
          chapterNumber: chapter.chapterNumber,
          chapterTitle: chapter.title ?? null,
          numberTokenIndex: chapter.tokenSpans.number?.start ?? null,
          titleTokenStart: chapter.tokenSpans.title?.start ?? null,
          titleTokenEnd: chapter.tokenSpans.title?.end ?? null,
          urlTokenIndex: chapter.tokenSpans.url?.start ?? null,
          chapterUrl: chapter.url ?? null,
          releaseDate: chapter.releaseDate ?? null,
          tableId: chapter.tableId,
          tableRow: chapter.tableRow,
          relationSource: chapter.relationSource,
          confidence: chapter.confidence,
        },
      });
    })
  );

  return chapters.length;
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Get list page record with all related data
 */
export async function getListPageWithRelations(annotatedPageId: string): Promise<{
  listPage: Awaited<ReturnType<typeof prisma.listPageRecord.findUnique>>;
  volumes: Awaited<ReturnType<typeof prisma.volumeListRecord.findMany>>;
  chapters: Awaited<ReturnType<typeof prisma.chapterListRecord.findMany>>;
} | null> {
  const listPage = await prisma.listPageRecord.findUnique({
    where: { annotatedPageId },
  });

  if (!listPage) return null;

  const [volumes, chapters] = await Promise.all([
    prisma.volumeListRecord.findMany({
      where: { listPageId: listPage.id },
      orderBy: { volumeNumber: 'asc' },
    }),
    prisma.chapterListRecord.findMany({
      where: { listPageId: listPage.id },
      orderBy: { chapterNumber: 'asc' },
    }),
  ]);

  return { listPage, volumes, chapters };
}

/**
 * Update validation status for a list page
 */
export async function updateValidationStatus(
  listPageId: string,
  status: 'UNVALIDATED' | 'VALIDATED' | 'NEEDS_REVIEW' | 'REJECTED',
  notes?: string
): Promise<void> {
  const data: { validationStatus: typeof status; validationNotes?: string | null } = {
    validationStatus: status,
  };

  if (notes !== undefined) {
    data.validationNotes = notes;
  }

  await prisma.listPageRecord.update({
    where: { id: listPageId },
    data,
  });
}

/**
 * Get chapters for a specific volume
 */
export async function getChaptersForVolume(volumeRecordId: string): Promise<
  Awaited<ReturnType<typeof prisma.chapterListRecord.findMany>>
> {
  return prisma.chapterListRecord.findMany({
    where: { volumeRecordId },
    orderBy: { chapterNumber: 'asc' },
  });
}

/**
 * Get statistics for list pages
 */
export async function getListPageStats(): Promise<{
  totalPages: number;
  byStatus: Record<string, number>;
  avgVolumesPerPage: number;
  avgChaptersPerPage: number;
}> {
  const [pages, statusCounts] = await Promise.all([
    prisma.listPageRecord.aggregate({
      _count: true,
      _avg: {
        volumeCount: true,
        chapterCount: true,
      },
    }),
    prisma.listPageRecord.groupBy({
      by: ['validationStatus'],
      _count: true,
    }),
  ]);

  const byStatus: Record<string, number> = {};
  for (const item of statusCounts) {
    byStatus[item.validationStatus] = item._count;
  }

  return {
    totalPages: pages._count,
    byStatus,
    avgVolumesPerPage: pages._avg.volumeCount ?? 0,
    avgChaptersPerPage: pages._avg.chapterCount ?? 0,
  };
}
