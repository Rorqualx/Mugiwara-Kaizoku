/**
 * Search Metadata Router
 *
 * Handles metadata retrieval operations.
 *
 * Procedures:
 * - getMetadata: Get detailed manga metadata from provider
 *
 * Extracted from: search.ts (lines 589-610)
 */

import { z } from 'zod';


import type { SearchResult } from '@/server/services/search/types';
import { unifiedProviderRegistry } from '@/server/services/search/UnifiedProviderRegistry';
import { publicProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';
import { logger } from '@/utils/logging';

// Import from foundation utils
import { handleSearchError } from './utils';

export const searchMetadataRouter = router({
  getMetadata: publicProcedure
    .input(
      z.object({
        provider: z.string(),
        id: z.string(),
        title: z.string().optional(),
      })
    )
    .query(async ({ input }): Promise<SearchResult> => {
      try {
        logger.info(`Metadata request for ${input.provider} ID: ${input.id}`);

        // Get metadata from provider
        const metadata = await unifiedProviderRegistry.getMetadata(
          input.provider,
          input.id,
          input.title
        );

        // Ensure provider is always set to match the SearchResult type requirement
        return {
          ...metadata,
          provider: metadata.provider ?? input.provider,
        };
      } catch (error: unknown) {
        handleSearchError(error, 'getMetadata');
      }
    }),
});
