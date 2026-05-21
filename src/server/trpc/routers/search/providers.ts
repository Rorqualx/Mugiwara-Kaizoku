/**
 * Search Providers Router
 *
 * Handles provider management operations.
 *
 * Procedures:
 * - getProviders: List available providers with status
 * - setDefaultProvider: Set default search provider (protected)
 *
 * Extracted from: search.ts (lines 616-666)
 */

import { z } from 'zod';


import { unifiedProviderRegistry } from '@/server/services/search/UnifiedProviderRegistry';
import { protectedProcedure, publicProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';
import type { AsyncResult } from '@/utils/async-result';
import { createSuccessResult } from '@/utils/async-result';


// Import from foundation utils
import { getProviderDisplayName, handleSearchError } from './utils';

export const searchProvidersRouter = router({
  /**
   * Get available providers with metadata
   *
   * @returns Array of provider objects with id, name, and status
   */
  getProviders: publicProcedure.query(
    (): Array<{ id: string; name: string; status: string }> => {
      try {
        const providerIds = unifiedProviderRegistry.getAvailableProviders();

        // Map provider IDs to provider objects with metadata
        const providers = providerIds.map((providerId) => {
          // Check if provider is enabled
          const isEnabled =
            unifiedProviderRegistry.isProviderEnabled(providerId);

          // Return provider object with metadata (uses helper from utils)
          return {
            id: providerId,
            name: getProviderDisplayName(providerId),
            status: isEnabled ? 'active' : 'disabled',
          };
        });

        return providers;
      } catch (error: unknown) {
        handleSearchError(error, 'getProviders');
      }
    }
  ),

  /**
   * Set the default provider
   *
   * @param {object} input - Provider parameters
   * @param {string} input.provider - Provider type to set as default
   * @returns {Promise<AsyncResult<boolean, Error>>} Success result
   */
  setDefaultProvider: protectedProcedure
    .input(
      z.object({
        provider: z.string(),
      })
    )
    .mutation(
      async ({ input }): Promise<AsyncResult<boolean, Error>> => {
        try {
          await unifiedProviderRegistry.setDefaultProvider(input.provider);
          return createSuccessResult(true);
        } catch (error: unknown) {
          handleSearchError(error, 'setDefaultProvider');
        }
      }
    ),
});
