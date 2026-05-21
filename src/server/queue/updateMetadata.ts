/**
 * @module server/queue/updateMetadata
 * @description Manga metadata update task management system
 * Provides functionality for:
 * - Processing metadata updates
 * - Scheduling update tasks
 * - Managing update task lifecycle
 * - Error handling and reporting
 *
 * @example
 * ```ts
 * // Update metadata directly
 * await processUpdateMetadataTask('/manga/library', 'One Piece');
 *
 * // Schedule update task
 * await enqueueUpdateMetadataTask({
 *   mangaId: 42,
 *   title: 'One Piece',
 *   libraryPath: '/manga/library',
 *   mangaTitle: 'One Piece'
 * });
 * ```
 */
import { logger } from '@/utils/logger';

import { refreshMetadata } from "../utils/integration/index";
// mangalService removed - mangal is deprecated
/**
 * Configuration data for metadata update tasks
 * @interface IUpdateMetadataWorkerData
 */
export interface IUpdateMetadataWorkerData {
    libraryPath: string;
    mangaTitle: string;
}
/**
 * Processes metadata updates for a manga
 * Updates local metadata and refreshes from source
 *
 * @param {string} libraryPath - Path to manga library
 * @param {string} mangaTitle - Title of manga to update
 * @returns {Promise<void>}
 * @throws {Error} When update fails
 *
 * @example
 * ```ts
 * await processUpdateMetadataTask(
 *   '/manga/library',
 *   'One Piece'
 * );
 * ```
 */
export async function processUpdateMetadataTask(libraryPath: string, mangaTitle: string): Promise<void> {
    try {
        logger.info(`ℹ️ Updating metadata for manga: ${mangaTitle} in library: ${libraryPath}`);
        // Update existing metadata
        // Mangal metadata update removed - deprecated
        // await mangalService.updateExistingMangaMetadata(libraryPath);
        // Refresh metadata for the manga
        await refreshMetadata(mangaTitle);
        logger.info(`✅ Metadata updated successfully for manga: ${mangaTitle}`);
    }
    catch (err: unknown) {
        if (err instanceof Error) {
            logger.error(`Error updating metadata for manga: ${mangaTitle}`, err);
        }
        else {
            logger.error(`Unknown error updating metadata for manga: ${mangaTitle}`, err);
        }
        throw err;
    }
}
/**
 * Schedules a metadata update task
 * Currently executes immediately for simplicity
 *
 * @param {string} libraryPath - Path to manga library
 * @param {string} mangaTitle - Title of manga to update
 * @returns {Promise<void>}
 * @throws {Error} When scheduling fails
 *
 * @example
 * ```ts
 * await scheduleUpdateMetadata(
 *   '/manga/library',
 *   'One Piece'
 * );
 * ```
 */
export async function scheduleUpdateMetadata(libraryPath: string, mangaTitle: string): Promise<void> {
    logger.info(`ℹ️ Scheduling metadata update for manga: ${mangaTitle}`);
    await processUpdateMetadataTask(libraryPath, mangaTitle);
}
/**
 * Creates a new metadata update task
 * Enqueues task with manga and library information
 *
 * @param {Object} data - Task configuration
 * @param {number} data.mangaId - Manga database ID
 * @param {string} data["title"] - Manga title
 * @param {string} data.libraryPath - Path to library
 * @param {string} data.mangaTitle - Title for metadata lookup
 * @returns {Promise<void>}
 * @throws {Error} When task creation fails
 *
 * @example
 * ```ts
 * await enqueueUpdateMetadataTask({
 *   mangaId: 42,
 *   title: 'One Piece',
 *   libraryPath: '/manga/library',
 *   mangaTitle: 'One Piece'
 * });
 * ```
 */
export async function enqueueUpdateMetadataTask(data: IUpdateMetadataWorkerData & {
    mangaId: number;
    title: string;
}): Promise<void> {
    const { libraryPath, mangaTitle } = data;
    logger.info(`ℹ️ Enqueuing metadata update task for manga: ${mangaTitle}`);
    await scheduleUpdateMetadata(libraryPath, mangaTitle);
}
