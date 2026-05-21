import { prisma } from "@/server/db";
import { toNumberId } from '@/utils/id-converters';
import { logger } from '@/utils/logger';

/**
 * Metadata URLs Service
 *
 * Service for managing and retrieving stored metadata URLs for manga.
 * This service provides a way to pass stored URLs to metadata providers
 * during refresh operations.
 */
// Singleton instance to store URLs during refresh operations
const currentRefreshUrls: Map<string, string[]> = new Map();
/**
 * Sets URLs for a manga refresh operation
 *
 * @param mangaId - The manga ID
 * @param urls - Array of URLs to use during refresh
 */
export function setRefreshUrls(mangaId: string, urls: string[]): void {
  currentRefreshUrls.set(mangaId, urls);
  logger.info(`Set ${urls.length} refresh URLs for manga ${mangaId}`);
}
/**
 * Gets URLs for a manga refresh operation
 *
 * @param mangaId - The manga ID
 * @returns Array of URLs or empty array
 */
export function getRefreshUrls(mangaId: string): string[] {
  const urls = currentRefreshUrls.get(mangaId) ?? [];
  if (urls.length > 0) {
    logger.info(`Retrieved ${urls.length} refresh URLs for manga ${mangaId}`);
  }
  return urls;
}
/**
 * Clears URLs for a manga after refresh
 *
 * @param mangaId - The manga ID
 */
export function clearRefreshUrls(mangaId: string): void {
  currentRefreshUrls.delete(mangaId);
  logger.info(`Cleared refresh URLs for manga ${mangaId}`);
}
/**
 * Gets stored URLs for a manga from the database
 *
 * @param mangaId - The manga ID (can be numeric or source-based)
 * @returns Promise resolving to array of URLs
 */
export async function getStoredUrlsForManga(mangaId: string | number): Promise<string[]> {
  try {
    let manga;
    // Check if it's a numeric ID
    if (typeof mangaId === 'number' || !isNaN(toNumberId(mangaId))) {
      manga = await prisma.manga.findUnique({
        where: {
          id: toNumberId(mangaId)
        }
      });
    } else
    {
      // It's a source-based ID, try to find by source
      const sourcePart = mangaId.split(':')[0];
      if (sourcePart) {
        manga = await prisma.manga.findFirst({
          where: {
            source: {
              contains: sourcePart
            }
          }
        });
      }
    }
    // The manga object does not have a metadata relation in the schema
    // Return empty array for now (may need to be refactored based on actual schema)
    if (!manga) {
      return [];
    }
    // TODO: Verify if manga has urls field or if this needs to access a different relation
    return [];
  }
  catch (error: unknown) {
  logger.error(`Error getting stored URLs for manga ${mangaId}:`, error);
    return [];
  }
}
// Export the service
export const metadataUrlsService = {
  setRefreshUrls,
  getRefreshUrls,
  clearRefreshUrls,
  getStoredUrlsForManga
};