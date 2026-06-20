/**
 * Add Manga Event and Auto-Download Helpers
 *
 * Helper functions for logging events and triggering auto-download
 * during manga import.
 *
 * Extracted from crudOperations.ts to reduce complexity.
 */

import { toStringId } from '@/utils/id-converters';
import { logInfo, logError, EventType, EventSource } from '@/utils/system-event-logger';

interface MangaInfo {
  id: number;
  title: string;
  source: string;
  libraryId: number;
}

/**
 * Log system event for manga added
 */
export async function logMangaAdded(manga: MangaInfo, userId?: string): Promise<void> {
  await logInfo(
    `Added new manga: ${manga.title}`,
    EventType.MANGA_ADDED,
    EventSource.MANGA,
    {
      relatedEntityId: toStringId(manga.id),
      relatedEntityType: 'manga',
      ...(userId !== undefined ? { userId } : {}),
      details: {
        title: manga.title,
        source: manga.source,
        libraryId: manga.libraryId
      }
    }
  );
}

// Auto-download trigger removed: it ran 2s after add, which raced enrichment
// (Phase 2 chapter reconciliation finishes ~T+5s) and read zero Chapter rows.
// The trigger now fires from runEnrichmentPipeline post-Phase-6 hook in
// pipeline-orchestrator.ts so chapter rows are guaranteed to exist.

/**
 * Log error event when add fails
 */
export async function logMangaAddError(
  title: string,
  source: string,
  libraryId: number,
  error: unknown
): Promise<void> {
  await logError(
    `Failed to add manga: ${title}`,
    EventSource.MANGA,
    error,
    {
      details: {
        title,
        source,
        libraryId
      }
    }
  );
}
