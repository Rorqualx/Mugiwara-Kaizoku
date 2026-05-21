/**
 * Provider Matching tRPC Router
 *
 * Exposes provider matching functionality through the tRPC API.
 * Allows clients to find manga matches across different providers
 * and get enriched metadata.
 */
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import type { BaseProviderConfig } from '@/server/adapters/base-metadata-adapter';
import { prisma } from '@/server/db';
import type { MetadataServiceOptions } from '@/server/services/metadata/metadata-types';
import type { ProviderMatchingServiceConfig } from '@/server/services/metadata/providerMatchingService';
import { ProviderMatchingService } from '@/server/services/metadata/providerMatchingService';
import { searchProviderRegistry } from '@/server/services/search/registerProviders';
import { getConfigJSON } from '@/server/utils/configReader';
import { isSuccess, isError } from '@/utils/async-result';
import { toNumberId } from '@/utils/id-converters';
import { serverLogger } from '@/utils/serverLogger';
import { isObject, hasProperty, isString, isNumber, isBoolean } from '@/utils/type-guards';


import { adminProcedure, protectedProcedure } from '../procedures';
import { router } from '../trpc';

// Type guard for provider config structure
interface ProviderConfig {
  enabled?: boolean;
  apiUrl?: string;
  apiKey?: string;
  apiEndpoint?: string;
  wikiDomain?: string;
  throttleMs?: number;
}

/**
 * Safely extracts a provider configuration from an unknown object
 */
function getProviderConfig(providers: unknown, providerName: string): ProviderConfig | null {
  if (!isObject(providers) || !hasProperty(providers, providerName)) {
    return null;
  }

  const providerData = providers[providerName];
  if (!isObject(providerData)) {
    return null;
  }

  const config: ProviderConfig = {};

  if (hasProperty(providerData, 'enabled') && isBoolean(providerData['enabled'])) {
    config.enabled = providerData['enabled'];
  }

  if (hasProperty(providerData, 'apiUrl') && isString(providerData['apiUrl'])) {
    config.apiUrl = providerData['apiUrl'];
  }

  if (hasProperty(providerData, 'apiKey') && isString(providerData['apiKey'])) {
    config.apiKey = providerData['apiKey'];
  }

  if (hasProperty(providerData, 'apiEndpoint') && isString(providerData['apiEndpoint'])) {
    config.apiEndpoint = providerData['apiEndpoint'];
  }

  if (hasProperty(providerData, 'wikiDomain') && isString(providerData['wikiDomain'])) {
    config.wikiDomain = providerData['wikiDomain'];
  }

  if (hasProperty(providerData, 'throttleMs') && isNumber(providerData['throttleMs'])) {
    config.throttleMs = providerData['throttleMs'];
  }

  return config;
}

/**
 * Builds AniList provider configuration
 */
function buildAnilistConfig(config: ProviderConfig | null): BaseProviderConfig | null {
  if (!config?.enabled) {
    return null;
  }

  return {
    enabled: true,
    apiUrl: config.apiUrl ?? 'https://graphql.anilist.co',
    timeout: config.throttleMs ?? 1000
  } as BaseProviderConfig;
}

/**
 * Builds ComicVine provider configuration
 */
function buildComicvineConfig(config: ProviderConfig | null): BaseProviderConfig | null {
  if (!config?.enabled || !config.apiKey) {
    return null;
  }

  return {
    enabled: true,
    apiKey: config.apiKey,
    apiEndpoint: config.apiEndpoint ?? 'https://comicvine.gamespot.com/api',
    timeout: config.throttleMs ?? 1000
  } as BaseProviderConfig;
}

/**
 * Builds Fandom provider configuration
 */
function buildFandomConfig(config: ProviderConfig | null): BaseProviderConfig | null {
  if (!config?.enabled || !config.wikiDomain) {
    return null;
  }

  return {
    enabled: true,
    apiUrl: config.wikiDomain,
    timeout: config.throttleMs ?? 1000
  } as BaseProviderConfig;
}

/**
 * Loads all provider configurations from database
 */
async function loadProviderConfigs(): Promise<MetadataServiceOptions['providerConfigs']> {
  const providerConfigs: Record<string, BaseProviderConfig> = {};

  try {
    const metadata = await getConfigJSON<unknown>('metadata.providers', {});
    const providers = metadata ?? {};

    // Configure each provider
    const anilistConfig = buildAnilistConfig(getProviderConfig(providers, 'anilist'));
    if (anilistConfig) {
      providerConfigs['anilist'] = anilistConfig;
    }

    const comicvineConfig = buildComicvineConfig(getProviderConfig(providers, 'comicvine'));
    if (comicvineConfig) {
      providerConfigs['comicvine'] = comicvineConfig;
    }

    const fandomConfig = buildFandomConfig(getProviderConfig(providers, 'fandom'));
    if (fandomConfig) {
      providerConfigs['fandom'] = fandomConfig;
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    serverLogger.error('Error parsing metadata configuration:', errorMessage);
  }

  return providerConfigs;
}

/**
 * Creates the default matching configuration
 */
function createDefaultMatchingConfig(): ProviderMatchingServiceConfig {
  return {
    minScore: 0.1,
    weights: {
      exact: 1.0,
      partial: 0.8,
      alternative: 0.7,
      pattern: 0.6
    },
    fetchMetadata: true,
    mergeMetadata: true
  };
}

// Initialize provider matching service with configuration from database
let providerMatchingService: ProviderMatchingService | null = null;
async function getProviderMatchingService(): Promise<ProviderMatchingService> {
  if (!providerMatchingService) {
    // CRITICAL: Initialize the search provider registry before using the matching service
    // This was missing - the registry was empty because initializeSearchProviders() was never called
    searchProviderRegistry.initialize();
    serverLogger.info('[providerMatching.router] Initialized searchProviderRegistry', {
      providers: Object.keys(searchProviderRegistry.getAll())
    });

    const providerConfigs = await loadProviderConfigs();
    const matchingConfig = createDefaultMatchingConfig();
    providerMatchingService = new ProviderMatchingService({ providerConfigs }, matchingConfig);
  }
  return providerMatchingService;
}
// Input validation schemas
const findCrossProviderMatchesInput = z.object({
  title: z.string().min(1, 'Title is required'),
  /** Alternative titles from primary provider (e.g., English/Romaji from AniList) */
  alternativeTitles: z.object({
    english: z.string().optional(),
    romaji: z.string().optional(),
    native: z.string().optional(),
    synonyms: z.array(z.string()).optional(),
  }).optional(),
  options: z.object({
    providers: z.array(z.string()).optional(),
    limit: z.number().min(1).max(100).optional(),
    fetchMetadata: z.boolean().optional(),
    mergeMetadata: z.boolean().optional()
  }).optional()
});
const findProviderToProviderMatchInput = z.object({
  title: z.string().min(1, 'Title is required'),
  sourceProvider: z.string().min(1, 'Source provider is required'),
  targetProvider: z.string().min(1, 'Target provider is required'),
  fetchMetadata: z.boolean().optional()
});
const getEnrichedMetadataInput = z.object({
  mangaId: z.string().min(1, 'Manga ID is required'),
  currentProvider: z.string().min(1, 'Current provider is required'),
  title: z.string().min(1, 'Title is required')
});
const updateMatchingConfigInput = z.object({
  minScore: z.number().min(0).max(1).optional(),
  weights: z.object({
    exact: z.number().min(0).max(1).optional(),
    partial: z.number().min(0).max(1).optional(),
    alternative: z.number().min(0).max(1).optional(),
    pattern: z.number().min(0).max(1).optional()
  }).optional(),
  excludeProviders: z.array(z.string()).optional(),
  fetchMetadata: z.boolean().optional(),
  mergeMetadata: z.boolean().optional()
});
// Create the router
export const providerMatchingRouter = router({
  /**
   * Find matches across multiple providers
   */
  findCrossProviderMatches: protectedProcedure.
  input(findCrossProviderMatchesInput).
  query(async ({ input }) => {
    serverLogger.warn('[providerMatching.router] findCrossProviderMatches called', { input });
    try {
      const service = await getProviderMatchingService();
      serverLogger.warn('[providerMatching.router] Available providers', { providers: service.getAvailableProviders() });
      // Update config if options provided
      if (input.options?.fetchMetadata !== undefined || input.options?.mergeMetadata !== undefined) {
        const configUpdate: Partial<ProviderMatchingServiceConfig> = {};
        if (input.options.fetchMetadata !== undefined) {
          configUpdate.fetchMetadata = input.options.fetchMetadata;
        }
        if (input.options.mergeMetadata !== undefined) {
          configUpdate.mergeMetadata = input.options.mergeMetadata;
        }
        service.updateConfig(configUpdate);
      }
      const matchOptions: {
        providers?: string[];
        limit?: number;
        alternativeTitles?: {
          english?: string | undefined;
          romaji?: string | undefined;
          native?: string | undefined;
          synonyms?: string[] | undefined;
        };
      } = {};
      if (input.options?.providers !== undefined) {
        matchOptions.providers = input.options.providers;
      }
      if (input.options?.limit !== undefined) {
        matchOptions.limit = input.options.limit;
      }
      // Pass alternative titles to improve ComicVine matching
      if (input.alternativeTitles) {
        matchOptions.alternativeTitles = input.alternativeTitles;
      }
      const result = await service.findCrossProviderMatches(input["title"], matchOptions);
      if (isSuccess(result)) {
        return result.data;
      } else if (isError(result)) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: result.error instanceof Error ? result.error.message : String(result.error),
          cause: result.error
        });
      }
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Unknown error occurred'
      });
    }
    catch (error: unknown) {
      serverLogger.error('Error in findCrossProviderMatches:', error);
      if (error instanceof TRPCError) {
        throw error;
      }
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to find cross-provider matches'
      });
    }
  }),
  /**
   * Find match between two specific providers
   */
  findProviderToProviderMatch: protectedProcedure.
  input(findProviderToProviderMatchInput).
  query(async ({ input }) => {
    try {
      const service = await getProviderMatchingService();
      // Update config if fetchMetadata provided
      if (input.fetchMetadata !== undefined) {
        service.updateConfig({ fetchMetadata: input.fetchMetadata });
      }
      const result = await service.findProviderToProviderMatch(input["title"], input.sourceProvider, input.targetProvider);
      if (isSuccess(result)) {
        return result.data;
      } else if (isError(result)) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: result.error instanceof Error ? result.error.message : String(result.error),
          cause: result.error
        });
      }
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Unknown error occurred'
      });
    }
    catch (error: unknown) {
      serverLogger.error('Error in findProviderToProviderMatch:', error);
      if (error instanceof TRPCError) {
        throw error;
      }
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to find provider match'
      });
    }
  }),
  /**
   * Get enriched metadata by combining data from multiple providers
   */
  getEnrichedMetadata: protectedProcedure.
  input(getEnrichedMetadataInput).
  query(async ({ input }) => {
    try {
      const service = await getProviderMatchingService();
      const result = await service.getEnrichedMetadata(input.mangaId, input.currentProvider, input["title"]);
      if (isSuccess(result)) {
        return result.data;
      } else if (isError(result)) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: result.error instanceof Error ? result.error.message : String(result.error),
          cause: result.error
        });
      }
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Unknown error occurred'
      });
    }
    catch (error: unknown) {
      serverLogger.error('Error in getEnrichedMetadata:', error);
      if (error instanceof TRPCError) {
        throw error;
      }
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get enriched metadata'
      });
    }
  }),
  /**
   * Get available providers
   */
  getAvailableProviders: protectedProcedure.
  query(async () => {
    try {
      const service = await getProviderMatchingService();
      return service.getAvailableProviders();
    }
    catch (error: unknown) {
      serverLogger.error('Error getting available providers:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get available providers'
      });
    }
  }),
  /**
   * Update matching configuration
   */
  updateMatchingConfig: adminProcedure.
  input(updateMatchingConfigInput).
  mutation(async ({ input }) => {
    try {
      const service = await getProviderMatchingService();
      const configUpdate: Partial<ProviderMatchingServiceConfig> = {};
      if (input.minScore !== undefined) configUpdate.minScore = input.minScore;
      if (input.weights !== undefined) {
        const weights: { exact?: number; partial?: number; alternative?: number; pattern?: number } = {};
        if (input.weights.exact !== undefined) weights.exact = input.weights.exact;
        if (input.weights.partial !== undefined) weights.partial = input.weights.partial;
        if (input.weights.alternative !== undefined) weights.alternative = input.weights.alternative;
        if (input.weights.pattern !== undefined) weights.pattern = input.weights.pattern;
        configUpdate.weights = weights;
      }
      if (input.excludeProviders !== undefined) configUpdate.excludeProviders = input.excludeProviders;
      if (input.fetchMetadata !== undefined) configUpdate.fetchMetadata = input.fetchMetadata;
      if (input.mergeMetadata !== undefined) configUpdate.mergeMetadata = input.mergeMetadata;
      service.updateConfig(configUpdate);
      return {
        success: true,
        message: 'Configuration updated successfully'
      };
    }
    catch (error: unknown) {
      serverLogger.error('Error updating matching config:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to update configuration'
      });
    }
  }),
  /**
   * Match manga from database with external providers
   */
  matchDatabaseManga: protectedProcedure.
  input(z.object({
    mangaId: z.number().min(1, 'Manga ID is required'),
    targetProviders: z.array(z.string()).optional()
  })).
  query(async ({ input }) => {
    try {
      // Get manga from database
      const manga = await prisma.manga.findUnique({
        where: { id: input.mangaId }
      });
      if (!manga) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Manga not found'
        });
      }
      const service = await getProviderMatchingService();
      // Find matches using manga title
      const matchOptions: { providers?: string[] } = {};
      if (input.targetProviders !== undefined) {
        matchOptions.providers = input.targetProviders;
      }
      const result = await service.findCrossProviderMatches(manga["title"], matchOptions);
      if (isSuccess(result)) {
        // Store matched provider IDs in the response
        const matchedProviderIds: Record<string, string> = {};
        result.data.matches.forEach((match) => {
          matchedProviderIds[match.provider] = match.providerId;
        });
        return {
          mangaId: toNumberId(manga["id"]),
          mangaTitle: manga["title"],
          currentSource: manga["source"],
          matches: result.data.matches,
          bestMatch: result.data.bestMatch,
          mergedMetadata: result.data.mergedMetadata,
          matchedProviderIds
        };
      } else
      if (isError(result)) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: result.error instanceof Error ? result.error.message : String(result.error),
          cause: result.error
        });
      }
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Unknown error occurred'
      });
    }
    catch (error: unknown) {
      serverLogger.error('Error in matchDatabaseManga:', error);
      if (error instanceof TRPCError) {
        throw error;
      }
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to match database manga'
      });
    }
  })
});