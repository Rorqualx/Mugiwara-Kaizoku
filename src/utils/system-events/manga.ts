/**
 * Manga & Metadata Event Logging Functions
 *
 * Logging functions for manga operations (add, remove, update, transfer)
 * and metadata operations (refresh, conflicts, errors).
 *
 * Extracted from: systemEvents.ts
 */

import { emitEvent } from '../eventEmitter';

/**
 * Logs a manga addition event
 * Emits an info event when a manga is added to a library
 *
 * @param {string} title - Title of the added manga
 * @param {number} mangaId - ID of the added manga
 * @param {string} libraryName - Name of the library the manga was added to
 * @param {number} libraryId - ID of the library the manga was added to
 *
 * @example
 * ```ts
 * logMangaAdded("One Piece", 1, "Shonen Collection", 2);
 * ```
 */
export function logMangaAdded(title: string, mangaId: number, libraryName: string, libraryId: number): void {
  emitEvent('info', `Manga added to library: ${title} in ${libraryName}`, 'Manga', {
    details: { message: `The manga "${title}" has been added to the library "${libraryName}".` },
    entityId: mangaId,
    entityType: 'manga',
    entityName: title,
    actions: [
      { label: 'View Manga', action: 'navigate', url: `/library/${libraryId}/${mangaId}` },
      { label: 'View Library', action: 'navigate', url: `/library/${libraryId}` }
    ]
  });
}

/**
 * Logs a manga removal event
 * Emits an info event when a manga is removed from the system
 *
 * @param {string} title - Title of the removed manga
 * @param {number} mangaId - ID of the removed manga
 *
 * @example
 * ```ts
 * logMangaRemoved("Naruto", 5);
 * ```
 */
export function logMangaRemoved(title: string, mangaId: number): void {
  emitEvent('info', `Manga removed: ${title}`, 'Manga', {
    details: { message: `The manga "${title}" has been removed.` },
    entityId: mangaId,
    entityType: 'manga',
    entityName: title
  });
}

/**
 * Logs a manga update event
 * Emits an info event when a manga's metadata or files are updated
 *
 * @param {string} title - Title of the updated manga
 * @param {number} mangaId - ID of the updated manga
 * @param {number} libraryId - ID of the library containing the manga
 *
 * @example
 * ```ts
 * logMangaUpdated("Bleach", 3, 1);
 * ```
 */
export function logMangaUpdated(title: string, mangaId: number, libraryId: number): void {
  emitEvent('info', `Manga updated: ${title}`, 'Manga', {
    details: { message: `The manga "${title}" has been updated.` },
    entityId: mangaId,
    entityType: 'manga',
    entityName: title,
    actions: [
      { label: 'View Manga', action: 'navigate', url: `/library/${libraryId}/${mangaId}` }
    ]
  });
}

/**
 * Logs a manga error event
 * Emits an error event when an operation on a manga fails
 *
 * @param {string} title - Title of the manga
 * @param {number} mangaId - ID of the manga
 * @param {string} error - Brief error message
 * @param {string} [errorDetails] - Detailed error information
 *
 * @example
 * ```ts
 * logMangaError("Dragon Ball", 4, "Failed to parse metadata", "Invalid JSON response");
 * ```
 */
export function logMangaError(title: string, mangaId: number, error: string, errorDetails?: string): void {
  emitEvent('error', `Error with manga ${title}: ${error}`, 'Manga', {
    details: { message: `An error occurred while processing the manga "${title}".` },
    entityId: mangaId,
    entityType: 'manga',
    entityName: title,
    errorDetails: errorDetails ?? error
  });
}

/**
 * Logs a metadata refresh start event
 * Emits an info event when metadata refresh begins for a manga
 *
 * @param {string} title - Title of the manga
 * @param {number} mangaId - ID of the manga
 *
 * @example
 * ```ts
 * logMetadataRefresh("One Piece", 1);
 * ```
 */
export function logMetadataRefresh(title: string, mangaId: number): void {
  emitEvent('info', `Refreshing metadata for: ${title}`, 'Metadata', {
    details: { message: `Started refreshing metadata for "${title}".` },
    entityId: mangaId,
    entityType: 'manga',
    entityName: title
  });
}

/**
 * Logs a metadata refresh completion event
 * Emits a success event when metadata refresh completes for multiple items
 *
 * @param {number} count - Number of items refreshed
 *
 * @example
 * ```ts
 * logMetadataRefreshComplete(5);
 * ```
 */
export function logMetadataRefreshComplete(count: number): void {
  emitEvent('success', `Metadata refresh completed for ${count} items`, 'Metadata', {
    details: { message: `Successfully refreshed metadata for ${count} items.` }
  });
}

/**
 * Logs a metadata error event
 * Emits an error event when metadata refresh fails for a manga
 *
 * @param {string} title - Title of the manga
 * @param {number} mangaId - ID of the manga
 * @param {string} error - Brief error message
 * @param {string} [errorDetails] - Detailed error information
 *
 * @example
 * ```ts
 * logMetadataError("One Piece", 1, "API error", "Failed to fetch from AniList");
 * ```
 */
export function logMetadataError(title: string, mangaId: number, error: string, errorDetails?: string): void {
  emitEvent('error', `Metadata error for ${title}: ${error}`, 'Metadata', {
    details: { message: `Failed to refresh metadata for "${title}".` },
    entityId: mangaId,
    entityType: 'manga',
    entityName: title,
    errorDetails: errorDetails ?? error,
    actions: [
      { label: 'Retry Metadata Refresh', action: 'refreshMetadata', entityId: mangaId }
    ]
  });
}

/**
 * Logs a manga transfer between libraries
 *
 * @param {string} title - Manga title
 * @param {number} mangaId - Manga ID
 * @param {string} fromLibrary - Source library name
 * @param {string} toLibrary - Destination library name
 *
 * @example
 * ```ts
 * logMangaTransferred("One Piece", 1, "Reading", "Completed");
 * ```
 */
export function logMangaTransferred(
  title: string,
  mangaId: number,
  fromLibrary: string,
  toLibrary: string
): void {
  emitEvent(
    'info',
    `Manga transferred: ${title} from ${fromLibrary} to ${toLibrary}`,
    'Manga',
    {
      details: {
        type: 'manga_transferred',
        mangaTitle: title,
        mangaId,
        fromLibrary,
        toLibrary
      }
    }
  );
}

/**
 * Logs manga binding to AniList
 *
 * @param {string} title - Manga title
 * @param {number} mangaId - Manga ID
 * @param {number} anilistId - AniList ID
 *
 * @example
 * ```ts
 * logMangaBoundToAnilist("One Piece", 1, 21);
 * ```
 */
export function logMangaBoundToAnilist(
  title: string,
  mangaId: number,
  anilistId: number
): void {
  emitEvent(
    'success',
    `Manga bound to AniList: ${title}`,
    'Manga',
    {
      details: {
        type: 'manga_bound_anilist',
        mangaTitle: title,
        mangaId,
        anilistId
      }
    }
  );
}

/**
 * Logs metadata conflict detection
 *
 * @param {string} title - Manga title
 * @param {number} mangaId - Manga ID
 * @param {number} conflictCount - Number of conflicts
 *
 * @example
 * ```ts
 * logMetadataConflict("One Piece", 1, 3);
 * ```
 */
export function logMetadataConflict(
  title: string,
  mangaId: number,
  conflictCount: number
): void {
  emitEvent(
    'warning',
    `Metadata conflicts detected: ${title} (${conflictCount} conflicts)`,
    'Metadata',
    {
      details: {
        type: 'metadata_conflict',
        mangaTitle: title,
        mangaId,
        conflictCount
      }
    }
  );
}

/**
 * Logs successful metadata refresh
 *
 * @param {string} title - Manga title
 * @param {number} mangaId - Manga ID
 * @param {string} source - Metadata source
 *
 * @example
 * ```ts
 * logMetadataRefreshed("One Piece", 1, "AniList");
 * ```
 */
export function logMetadataRefreshed(
  title: string,
  mangaId: number,
  source: string
): void {
  emitEvent(
    'success',
    `Metadata refreshed: ${title} from ${source}`,
    'Metadata',
    {
      details: {
        type: 'metadata_refreshed',
        mangaTitle: title,
        mangaId,
        source
      }
    }
  );
}

/**
 * Logs bulk operation completion
 *
 * @param {string} operation - Operation type
 * @param {number} successCount - Successful items
 * @param {number} totalCount - Total items
 *
 * @example
 * ```ts
 * logBulkOperation("metadata refresh", 45, 50);
 * ```
 */
export function logBulkOperation(
  operation: string,
  successCount: number,
  totalCount: number
): void {
  const status = successCount === totalCount ? 'success' : 'warning';
  emitEvent(
    status,
    `Bulk ${operation}: ${successCount}/${totalCount} successful`,
    'Manga',
    {
      details: {
        type: 'bulk_operation',
        operation,
        successCount,
        totalCount
      }
    }
  );
}

/**
 * Logs new chapters detection
 *
 * @param {string} title - Manga title
 * @param {number} mangaId - Manga ID
 * @param {number} chapterCount - Number of new chapters
 *
 * @example
 * ```ts
 * logNewChapters("One Piece", 1, 5);
 * ```
 */
export function logNewChapters(
  title: string,
  mangaId: number,
  chapterCount: number
): void {
  emitEvent(
    'info',
    `New chapters found: ${title} (${chapterCount} new)`,
    'Manga',
    {
      details: {
        type: 'new_chapters',
        mangaTitle: title,
        mangaId,
        chapterCount
      }
    }
  );
}
