/**
 * Provider Registry Metadata Operations
 *
 * Metadata operations with fallback provider support.
 * Implements sequential fallback pattern for resilient metadata retrieval.
 *
 * Extracted from: registry.ts (lines 325-362)
 */

import type { MangaMetadata } from '@/types/search.types';
import type { AsyncResult } from '@/utils/async-result';
import { createErrorResult, isSuccess } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import type { ProviderConfig, ProviderStrategy } from './types';
import type { MetadataProvider } from '@prisma/client';

// ============================================================================
// Metadata Operations
// ============================================================================

/**
 * Options for getMetadataWithFallback function
 */
export interface GetMetadataWithFallbackOptions {
  /** Function to ensure providers are initialized */
  initialize: () => Promise<void>;
  /** Function to retrieve provider instance */
  getProvider: (type: MetadataProvider) => ProviderStrategy | undefined;
  /** Function to retrieve provider configuration */
  getConfig: (type: MetadataProvider) => ProviderConfig | undefined;
  /** Whether fallback providers are enabled */
  enableFallback: boolean;
  /** Primary provider type */
  type: MetadataProvider;
  /** Metadata identifier */
  id: string;
  /** Optional provider-specific options */
  options?: unknown;
}

/**
 * Get metadata with fallback provider support
 *
 * Implements sequential fallback pattern: tries primary provider first,
 * then falls back to configured fallback providers in order until one succeeds.
 *
 * @param params - Options for metadata retrieval with fallback
 * @returns AsyncResult containing metadata or error
 */
export async function getMetadataWithFallback(
  params: GetMetadataWithFallbackOptions
): Promise<AsyncResult<MangaMetadata, Error>> {
  const { initialize, getProvider, getConfig, enableFallback, type, id, options } = params;

  // Ensure providers are initialized
  await initialize();

  const provider = getProvider(type);

  if (!provider) {
    return createErrorResult(new Error(`Provider ${type} not found`));
  }

  // Try primary provider
  const result = await provider.getMetadata(id, options);

  if (isSuccess(result) || !enableFallback) {
    return result;
  }

  // Try fallback providers
  const config = getConfig(type);
  const fallbackTypes = config?.fallbackProviders ?? [];

  for (const fallbackType of fallbackTypes) {
    const fallbackProvider = getProvider(fallbackType);
    if (!fallbackProvider) continue;

    // eslint-disable-next-line no-await-in-loop -- Sequential fallback pattern: only try next provider if previous fails, early return on first success
    const fallbackResult = await fallbackProvider.getMetadata(id, options);
    if (isSuccess(fallbackResult)) {
      logger.info(`Used fallback provider ${fallbackType} for ${id}`);
      return fallbackResult;
    }
  }

  return result; // Return original error
}
