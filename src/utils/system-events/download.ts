/**
 * Download Event Logging Functions
 *
 * Logging functions for download operations including start, complete,
 * error, cancel, queue, and retry events.
 *
 * Extracted from: systemEvents.ts
 */

import { emitEvent } from '../eventEmitter';

/**
 * Logs a download start event
 * Emits an info event when a chapter download begins
 *
 * @param {string} title - Title of the manga
 * @param {string} chapter - Chapter identifier
 * @param {number} _mangaId - ID of the manga (unused but kept for API compatibility)
 * @param {number} chapterId - ID of the chapter
 *
 * @example
 * ```ts
 * logDownloadStarted("One Piece", "Chapter 1042", 1, 1042);
 * ```
 */
export function logDownloadStarted(
  title: string,
  chapter: string,
  _mangaId: number,
  chapterId: number
): void {
  emitEvent('info', `Download started: ${title} - ${chapter}`, 'Download', {
    details: { message: `Started downloading chapter "${chapter}" of "${title}".` },
    entityId: chapterId,
    entityType: 'chapter',
    entityName: `${title} - ${chapter}`,
    actions: [{ label: 'View Downloads', action: 'navigate', url: '/downloads' }]
  });
}

/**
 * Logs a download completion event
 * Emits a success event when a chapter download completes
 *
 * @param {string} title - Title of the manga
 * @param {string} chapter - Chapter identifier
 * @param {number} mangaId - ID of the manga
 * @param {number} chapterId - ID of the chapter
 * @param {string} [filePath] - Path where the file was saved
 *
 * @example
 * ```ts
 * logDownloadComplete("One Piece", "Chapter 1042", 1, 1042, "/manga/one-piece/1042.cbz");
 * ```
 */
export function logDownloadComplete(
  title: string,
  chapter: string,
  mangaId: number,
  chapterId: number,
  filePath?: string
): void {
  emitEvent('success', `Download completed: ${title} - ${chapter}`, 'Download', {
    details: { message: `Successfully downloaded chapter "${chapter}" of "${title}".` },
    entityId: chapterId,
    entityType: 'chapter',
    entityName: `${title} - ${chapter}`,
    actions: [
      { label: 'View Chapter', action: 'navigate', url: `/reader/${mangaId}/${chapterId}` },
      ...(filePath ? [{ label: 'Open File Location', action: 'openFile', entityId: filePath }] : [])
    ]
  });
}

/**
 * Logs a download error event
 * Emits an error event when a chapter download fails
 *
 * @param options - Download error options
 * @param options.title - Title of the manga
 * @param options.chapter - Chapter identifier
 * @param options.mangaId - ID of the manga
 * @param options.chapterId - ID of the chapter
 * @param options.error - Brief error message
 * @param options.errorDetails - Detailed error information (optional)
 *
 * @example
 * ```ts
 * logDownloadError({
 *   title: "One Piece",
 *   chapter: "Chapter 1042",
 *   mangaId: 123,
 *   chapterId: 1042,
 *   error: "Network error",
 *   errorDetails: "Connection timeout"
 * });
 * ```
 */
export function logDownloadError(options: {
  title: string;
  chapter: string;
  mangaId: number;
  chapterId: number;
  error: string;
  errorDetails?: string;
}): void {
  const { title, chapter, chapterId, error, errorDetails } = options;
  emitEvent('error', `Download failed: ${title} - ${chapter}: ${error}`, 'Download', {
    details: { message: `Failed to download chapter "${chapter}" of "${title}".` },
    entityId: chapterId,
    entityType: 'chapter',
    entityName: `${title} - ${chapter}`,
    errorDetails: errorDetails ?? error,
    actions: [{ label: 'Retry Download', action: 'retryDownload', entityId: chapterId }]
  });
}

/**
 * Logs a download cancellation event
 * Emits a warning event when a chapter download is cancelled
 *
 * @param {string} title - Title of the manga
 * @param {string} chapter - Chapter identifier
 * @param {number} _mangaId - ID of the manga (unused but kept for API compatibility)
 * @param {number} chapterId - ID of the chapter
 *
 * @example
 * ```ts
 * logDownloadCancelled("One Piece", "Chapter 1042", 1, 1042);
 * ```
 */
export function logDownloadCancelled(
  title: string,
  chapter: string,
  _mangaId: number,
  chapterId: number
): void {
  emitEvent('warning', `Download cancelled: ${title} - ${chapter}`, 'Download', {
    details: { message: `The download of chapter "${chapter}" of "${title}" was cancelled.` },
    entityId: chapterId,
    entityType: 'chapter',
    entityName: `${title} - ${chapter}`,
    actions: [{ label: 'Retry Download', action: 'retryDownload', entityId: chapterId }]
  });
}

/**
 * Logs download queue addition
 *
 * @param {string} title - Manga title
 * @param {string} chapter - Chapter identifier
 * @param {number} queuePosition - Position in queue
 *
 * @example
 * ```ts
 * logDownloadQueued("One Piece", "Chapter 1042", 3);
 * ```
 */
export function logDownloadQueued(
  title: string,
  chapter: string,
  queuePosition: number
): void {
  emitEvent(
    'info',
    `Download queued: ${title} - ${chapter} (position ${queuePosition})`,
    'Download',
    {
      details: {
        type: 'download_queued',
        mangaTitle: title,
        chapter,
        queuePosition
      }
    }
  );
}

/**
 * Logs download retry after failure
 *
 * @param {string} title - Manga title
 * @param {string} chapter - Chapter identifier
 * @param {number} retryCount - Current retry attempt
 * @param {string} reason - Reason for retry
 *
 * @example
 * ```ts
 * logDownloadRetry("One Piece", "Chapter 1042", 2, "Network timeout");
 * ```
 */
export function logDownloadRetry(
  title: string,
  chapter: string,
  retryCount: number,
  reason: string
): void {
  emitEvent(
    'warning',
    `Download retry: ${title} - ${chapter} (attempt ${retryCount}) - ${reason}`,
    'Download',
    {
      details: {
        type: 'download_retry',
        mangaTitle: title,
        chapter,
        retryCount,
        reason
      }
    }
  );
}

/**
 * Logs download method selection
 *
 * @param {string} title - Manga title
 * @param {string} chapter - Chapter identifier
 * @param {string} method - Selected download method
 *
 * @example
 * ```ts
 * logDownloadMethodSelected("One Piece", "Chapter 1042", "direct");
 * ```
 */
export function logDownloadMethodSelected(
  title: string,
  chapter: string,
  method: string
): void {
  emitEvent(
    'info',
    `Download method selected: ${method} for ${title} - ${chapter}`,
    'Download',
    {
      details: {
        type: 'download_method_selected',
        mangaTitle: title,
        chapter,
        method
      }
    }
  );
}
