/**
 * Provider Operations Module
 *
 * Handles provider initialization, schedule fetching, and provider ID extraction
 * for the Release Schedule Aggregator.
 *
 * Extracted from: ReleaseScheduleAggregator.ts (lines 83-109, 176-212, 385-443)
 */

import type { AsyncResult } from '@/utils/async-result';
import { createSuccessResult, createErrorResult, isSuccess, isError } from '@/utils/async-result';
import { toNumberId } from '@/utils/id-converters';
import { createLogger } from '@/utils/logger';

import {
  handleError,
  isRecord,
  type ProviderScheduleData,
  MangaMetadataSchema,
} from './calendar-utils';

const logger = createLogger('ProviderOperations');

// ============================================================================
// Provider Initialization
// ============================================================================

/**
 * Provider factory registry for creating provider instances
 */
const providerFactories: Record<string, () => Record<string, unknown> | null> = {
  mangadex: () => null, // Added when adapter is available
  anilist: () => null,  // Added when adapter is available
};

/**
 * Default provider configuration
 */
const defaultProviderConfig: Record<string, { enabled: boolean; priority: number }> = {
  manual_override: { enabled: true, priority: 100 },
  mangadex: { enabled: true, priority: 80 },
  anilist: { enabled: true, priority: 70 },
  detected: { enabled: true, priority: 50 },
};

/**
 * Initialize a single provider
 * @returns 'initialized' | 'null' | 'error'
 */
function initializeSingleProvider(
  providerName: string,
  providers: Map<string, unknown>,
  priority: number
): 'initialized' | 'null' | 'error' {
  const factory = providerFactories[providerName];
  if (!factory) {
    return 'null';
  }

  try {
    const provider = factory();
    if (provider === null) {
      return 'null';
    }
    providers.set(providerName, provider);
    logger.info(`Initialized calendar provider: ${providerName}`, { providerName, priority });
    return 'initialized';
  } catch (error: unknown) {
    logger.error(`Failed to initialize provider ${providerName}`, {
      providerName,
      error: error instanceof Error ? error.message : String(error)
    });
    return 'error';
  }
}

/**
 * Initialize metadata providers with enhanced adapters
 */
export function initializeProviders(
  providers: Map<string, unknown>,
  enabledProviders?: string[],
  config?: Record<string, { enabled: boolean; priority: number }>
): void {
  const providerConfig = config ?? defaultProviderConfig;
  const providersToInit = enabledProviders ?? Object.keys(providerFactories);

  let initializedCount = 0;
  let failedCount = 0;

  for (const providerName of providersToInit) {
    const settings = providerConfig[providerName];
    if (settings && !settings.enabled) {
      continue;
    }

    const result = initializeSingleProvider(providerName, providers, settings?.priority ?? 50);
    if (result === 'initialized') initializedCount++;
    if (result === 'error') failedCount++;
  }

  logger.info('Provider initialization complete', {
    initialized: initializedCount,
    failed: failedCount,
    total: providersToInit.length
  });
}

/**
 * Register a new provider factory
 */
export function registerProviderFactory(
  name: string,
  factory: () => Record<string, unknown> | null
): void {
  providerFactories[name] = factory;
  logger.info(`Registered provider factory: ${name}`, { name });
}

/**
 * Get list of available provider names
 */
export function getAvailableProviders(): string[] {
  return Object.keys(providerFactories);
}

// ============================================================================
// Schedule Fetching
// ============================================================================

/**
 * Type guard for checking if a value is a callable function
 */
function isFunction(value: unknown): value is (...args: unknown[]) => unknown {
  return typeof value === 'function';
}

/**
 * Type for the enhanced manga data returned by providers
 */
interface EnhancedMangaData {
  releaseSchedule?: {
    confidence?: number;
    [key: string]: unknown;
  };
  recentReleases?: unknown[];
  publicationInfo?: unknown;
  [key: string]: unknown;
}

/**
 * Type guard for enhanced manga data
 */
function isEnhancedMangaData(data: unknown): data is EnhancedMangaData {
  return isRecord(data);
}

/**
 * Fetch release schedule from a specific provider
 *
 * @param provider - Provider object with getEnhancedMangaById method
 * @param mangaId - Provider-specific manga ID
 * @param providerName - Name of the provider (for logging/tracking)
 * @returns AsyncResult containing provider schedule data or error
 */
export async function fetchProviderSchedule(
  provider: Record<string, unknown>,
  mangaId: string,
  providerName: string
): Promise<AsyncResult<ProviderScheduleData, Error>> {
  try {
    const startTime = Date.now();

    // Verify provider has the required method
    const getEnhancedMangaById = provider['getEnhancedMangaById'];
    if (!isFunction(getEnhancedMangaById)) {
      return createErrorResult(
        new Error('Provider does not support getEnhancedMangaById')
      );
    }

    // Call the enhanced provider method with proper typing
    const result: unknown = await getEnhancedMangaById(mangaId);

    // Type guard for AsyncResult
    if (!isRecord(result)) {
      return createErrorResult(new Error('Invalid result format from provider'));
    }

    // Handle error result
    if (isError(result as AsyncResult<unknown, unknown>)) {
      const error = (result as Record<string, unknown>)['error'];
      return createErrorResult(
        error instanceof Error ? error : new Error(String(error))
      );
    }

    // Handle non-success result
    if (!isSuccess(result as AsyncResult<unknown, unknown>)) {
      return createErrorResult(new Error('Unknown state in provider result'));
    }

    // Extract and validate enhanced data
    const enhancedData = result['data'];
    if (!isEnhancedMangaData(enhancedData)) {
      return createErrorResult(new Error('Invalid enhanced data format'));
    }

    const releaseSchedule = enhancedData.releaseSchedule;
    const recentReleases = enhancedData.recentReleases;
    const publicationInfo = enhancedData.publicationInfo;

    // Build provider schedule data
    const providerData: ProviderScheduleData = {
      provider: providerName,
      lastUpdated: new Date(),
      schedule: releaseSchedule,
      recentChapters: Array.isArray(recentReleases) ? recentReleases : [],
      confidence:
        isRecord(releaseSchedule) && typeof releaseSchedule.confidence === 'number'
          ? releaseSchedule.confidence
          : 0,
      rawData: {
        fetchTime: Date.now() - startTime,
        publicationInfo,
      },
    };

    return createSuccessResult(providerData);
  } catch (error: unknown) {
    return createErrorResult(handleError(error));
  }
}

// ============================================================================
// Provider ID Extraction
// ============================================================================

/**
 * Parse manga metadata from string or object
 */
function parseMetadata(rawMetadata: unknown): unknown {
  if (typeof rawMetadata === 'string') {
    try {
      return JSON.parse(rawMetadata);
    } catch {
      return null;
    }
  }
  return rawMetadata;
}

/**
 * Type for validated manga metadata
 */
type ValidatedMetadata = {
  providers?: Record<string, { id?: string | undefined; [key: string]: unknown }> | undefined;
  [key: string]: unknown;
};

/**
 * Extract provider ID from validated metadata
 */
function extractProviderIdFromMetadata(
  metadata: ValidatedMetadata,
  provider: string
): string | undefined {
  const providers = metadata.providers;
  if (!providers) {
    return undefined;
  }

  const providerData = providers[provider];
  if (!providerData?.id) {
    return undefined;
  }

  return providerData.id;
}

/**
 * Extract provider ID from manga links using URL pattern matching
 */
function extractProviderIdFromLinks(
  links: unknown,
  provider: string
): string | undefined {
  if (!Array.isArray(links)) {
    return undefined;
  }

  const providerUrls: Record<string, RegExp> = {
    anilist: /anilist\.co\/manga\/(\d+)/,
  };

  const pattern = providerUrls[provider];
  if (!pattern) {
    return undefined;
  }

  for (const link of links) {
    if (typeof link === 'string') {
      const match = link.match(pattern);
      if (match?.[1]) {
        return match[1];
      }
    }
  }

  return undefined;
}

/**
 * Extract provider-specific manga ID from manga metadata or links
 *
 * @param manga - Manga record containing metadata and/or links
 * @param provider - Provider name (e.g., 'anilist')
 * @returns Provider-specific manga ID or undefined if not found
 *
 * @remarks
 * Checks two sources in order:
 * 1. Metadata providers field (structured provider IDs)
 * 2. Links array (extracts ID from provider URLs)
 */
export function getProviderMangaId(
  manga: Record<string, unknown>,
  provider: string
): string | undefined {
  // Check metadata for provider IDs
  const metadataField = manga['metadata'];
  if (metadataField !== undefined && metadataField !== null) {
    try {
      const parsedMetadata = parseMetadata(metadataField);
      const result = MangaMetadataSchema.safeParse(parsedMetadata);

      if (!result.success) {
        logger.warn('Invalid manga metadata format', {
          mangaId: toNumberId(manga['id']),
          error: result.error,
        });
        return undefined;
      }

      const providerId = extractProviderIdFromMetadata(result.data, provider);
      if (providerId !== undefined) {
        return providerId;
      }
    } catch (error: unknown) {
      logger.error('Failed to parse manga metadata', {
        mangaId: toNumberId(manga['id']),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Check links for provider URLs
  const linksField = manga['links'];
  if (linksField !== undefined && linksField !== null) {
    const providerId = extractProviderIdFromLinks(linksField, provider);
    if (providerId !== undefined) {
      return providerId;
    }
  }

  return undefined;
}
