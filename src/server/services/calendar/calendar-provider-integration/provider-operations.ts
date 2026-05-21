/**
 * Calendar Provider Integration - Provider Operations
 *
 * Handles provider-specific operations including manga ID mapping
 * and determining which manga need syncing.
 *
 * Extracted from: CalendarProviderIntegrationService.ts (lines 239-291)
 */

import type { ReleaseScheduleSyncOptions } from '@/server/base/CalendarSupportedProvider';
import type { ID } from '@/types/search.types';
import { toNumberId, toStringId } from '@/utils/id-converters';

import type { ProviderIntegrationConfig } from './types';

/**
 * Get manga that need syncing based on options
 *
 * Fetches manga from the database based on provided sync options.
 * Filters by specific IDs if provided, otherwise returns monitored manga.
 * Optionally excludes manga in hiatus status.
 *
 * @param config - Provider integration configuration with Prisma client
 * @param options - Sync options including manga IDs and filtering preferences
 * @returns Array of manga records that need syncing
 */
export async function getMangaToSync(
  config: ProviderIntegrationConfig,
  options: ReleaseScheduleSyncOptions
): Promise<unknown[]> {
  const where: Record<string, unknown> = {};

  // Specific manga IDs
  if (options.mangaIds && options.mangaIds.length > 0) {
    where['id'] = {
      in: options.mangaIds.map(id => toNumberId(id))
    };
  } else {
    // Get monitored manga
    where['metadata'] = {
      path: ['isMonitored'],
      equals: true
    };
  }

  // Exclude hiatus manga unless requested
  if (!options.includeHiatus) {
    where['status'] = {
      not: 'HIATUS'
    };
  }

  return config.prisma.manga.findMany({
    where,
    select: {
      id: true,
      title: true,
      source: true,
      Metadata: true
    }
  });
}

/**
 * Get provider-specific manga ID from mapping
 *
 * Maps an internal manga ID to a provider-specific ID by checking
 * the manga's source field. Returns the string ID if the manga's
 * source matches the provider, otherwise checks for provider mappings.
 *
 * @param config - Provider integration configuration with Prisma client
 * @param mangaId - Internal manga ID to map
 * @param provider - Provider name to map to
 * @returns Provider-specific manga ID or null if mapping not found
 */
export async function getProviderMangaId(
  config: ProviderIntegrationConfig,
  mangaId: ID,
  provider: string
): Promise<string | null> {
  // Check if manga exists and has matching source
  const manga = await config.prisma.manga.findUnique({
    where: {
      id: toNumberId(mangaId)
    },
    select: {
      id: true,
      source: true
    }
  });

  if (manga?.['source'] === provider) {
    return toStringId(manga['id']);
  }

  // Check if there's a mapping in metadata
  // Implementation would depend on how provider mappings are stored
  return null;
}
