/**
 * Search Settings Router
 *
 * Handles search provider configuration including default provider,
 * provider-specific settings, and Prowlarr integration.
 *
 * Procedures:
 * - listProviders: List available search providers
 * - getConfig: Get search configuration
 * - updateConfig: Update search configuration
 * - setDefaultProvider: Set default search provider
 * - toggleProvider: Enable/disable a provider
 * - updateProwlarrConfig: Update Prowlarr configuration
 *
 * Extracted from: settings.ts (lines 132-352)
 */

import { z } from 'zod';

import { cacheProvider } from '@/server/cache/UnifiedCacheProvider';
import { searchConfigService } from '@/server/services/search/configService';
import type {
  ProviderSettings,
  SearchProviderConfig,
} from '@/server/services/search/configService';
import { toTRPCError } from '@/server/trpc/errors';
import { protectedProcedure, publicProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';
import { createContextualError } from '@/utils/async-result';
import { logger } from '@/utils/logging';

// Import from foundation utils
import { prowlarrConfigSchema, searchProviderSchema, searchProviders } from './utils';

export const settingsSearchRouter = router({
  /**
   * List search providers procedure
   *
   * Returns a list of available search providers.
   *
   * @returns {Array} Array of provider objects with id and name
   */
  listProviders: publicProcedure
    .output(z.array(z.object({ id: z.string(), name: z.string() })))
    .query((): Array<{ id: string; name: string }> => {
      return [...searchProviders];
    }),

  /**
   * Get search configuration procedure
   *
   * Retrieves the current search configuration including default provider,
   * enabled providers, and provider-specific settings.
   *
   * @returns {Object} The search configuration
   */
  getConfig: protectedProcedure.query(
    async (): Promise<SearchProviderConfig> => {
      try {
        // Check cache first (10 minute TTL)
        const cacheKey = 'settings:search:config';
        const cached = await cacheProvider.get(cacheKey);
        if (cached) {
          logger.debug('Cache hit for search.getConfig');
          return cached as SearchProviderConfig;
        }

        const config = await searchConfigService.loadConfig();

        // Cache the result (10 minutes)
        await cacheProvider.set(cacheKey, config, {
          ttl: 600, // 10 minutes
          namespace: 'settings',
          tags: ['settings', 'search', 'config'],
        });

        logger.debug('Cache miss for search.getConfig, cached for 600s');

        return config as SearchProviderConfig;
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Error getting search configuration: ${errorMessage}`);
        throw toTRPCError(
          error instanceof Error
            ? error
            : new Error(`Error getting search configuration: ${errorMessage}`)
        );
      }
    }
  ),

  /**
   * Update search configuration procedure
   *
   * Updates the search configuration.
   *
   * @param {Partial<SearchProviderConfig>} config - The search configuration to update
   * @returns {Object} Whether the update was successful
   */
  updateConfig: protectedProcedure
    .input(
      z.object({
        defaultProvider: z.string().optional(),
        searchAllByDefault: z.boolean().optional(),
        providers: z.record(searchProviderSchema).optional(),
      })
    )
    .mutation(async ({ input }): Promise<boolean> => {
      try {
        const partialConfig: Partial<SearchProviderConfig> = {};
        if (input.defaultProvider !== undefined) {
          partialConfig.defaultProvider = input.defaultProvider;
        }
        if (input.searchAllByDefault !== undefined) {
          partialConfig.searchAllByDefault = input.searchAllByDefault;
        }
        if (input.providers) {
          partialConfig.providers = input.providers as Record<string, ProviderSettings>;
        }
        await searchConfigService.saveConfig(partialConfig);

        // Invalidate search config cache
        await cacheProvider.del('settings:search:config');
        logger.debug('Cache invalidated for search.updateConfig');

        return true;
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Error updating search configuration: ${errorMessage}`);
        throw toTRPCError(
          createContextualError(errorMessage, 'CONFIGURATION_ERROR')
        );
      }
    }),

  /**
   * Set default provider procedure
   *
   * Sets the default search provider.
   *
   * @param {string} providerId - The provider ID to set as default
   * @returns {Object} Whether the update was successful
   */
  setDefaultProvider: protectedProcedure
    .input(
      z.object({
        providerId: z.string(),
      })
    )
    .mutation(async ({ input }): Promise<boolean> => {
      try {
        await searchConfigService.setDefaultProvider(input.providerId);
        return true;
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Error setting default provider: ${errorMessage}`);
        throw toTRPCError(
          createContextualError(errorMessage, 'CONFIGURATION_ERROR')
        );
      }
    }),

  /**
   * Toggle provider procedure
   *
   * Enables or disables a search provider.
   *
   * @param {string} providerId - The provider ID to toggle
   * @param {boolean} enabled - Whether the provider should be enabled
   * @returns {Object} Whether the update was successful
   */
  toggleProvider: protectedProcedure
    .input(
      z.object({
        providerId: z.string(),
        enabled: z.boolean(),
      })
    )
    .mutation(async ({ input }): Promise<boolean> => {
      try {
        const config = await searchConfigService.loadConfig();
        // Create a copy of the config to avoid mutating the original
        const updatedConfig: SearchProviderConfig = {
          ...config,
          providers: { ...config.providers },
        };
        // Update the provider's enabled status
        if (!updatedConfig.providers[input.providerId]) {
          updatedConfig.providers[input.providerId] = {
            enabled: input.enabled,
          };
        } else {
          updatedConfig.providers[input.providerId] = {
            ...updatedConfig.providers[input.providerId],
            enabled: input.enabled,
          };
        }
        await searchConfigService.saveConfig(updatedConfig);
        return true;
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Error toggling provider: ${errorMessage}`);
        throw toTRPCError(
          createContextualError(errorMessage, 'CONFIGURATION_ERROR')
        );
      }
    }),

  /**
   * Update Prowlarr configuration procedure
   *
   * Updates the Prowlarr configuration.
   *
   * @param {ProwlarrConfig} config - The Prowlarr configuration to update
   * @returns {Object} Whether the update was successful
   */
  updateProwlarrConfig: protectedProcedure
    .input(prowlarrConfigSchema)
    .mutation(async ({ input }): Promise<boolean> => {
      try {
        const partialConfig: Partial<SearchProviderConfig> = {
          prowlarrEnabled: input.enabled,
          prowlarrBaseURL: input.baseURL,
          prowlarrApiKey: input.apiKey,
        };
        await searchConfigService.saveConfig(partialConfig);
        return true;
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Error updating Prowlarr configuration: ${errorMessage}`);
        throw toTRPCError(
          createContextualError(errorMessage, 'CONFIGURATION_ERROR')
        );
      }
    }),
});
