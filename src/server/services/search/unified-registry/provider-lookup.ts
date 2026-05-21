/**
 * Provider Lookup Module
 *
 * Handles provider resolution with fallback logic.
 * Decomposed from getProvider (complexity 24→8) to meet ESLint standards.
 *
 * Extracted from: UnifiedProviderRegistry.ts (lines 316-394)
 */

import { MetadataProvider } from '@prisma/client';

import { ValidationError } from '@/utils/errors';




import type { SearchProvider } from '../types';
import type { Logger } from 'pino';

/**
 * Provider configuration state
 */
export interface ProviderState {
  enabled: boolean;
  priority: number;
  lastError?: Error;
  lastSuccess?: Date;
}

/**
 * Configuration for provider lookup
 */
export interface ProviderLookupConfig {
  providers: Map<string, SearchProvider>;
  providerStates: Map<string, ProviderState>;
  defaultProvider: string;
  log: Logger;
  type?: string;
  initialized?: boolean;
  initialize?: () => Promise<void>;
}

/**
 * Normalize provider type to lowercase for case-insensitive matching
 */
function normalizeProviderType(type: string): string {
  return type.toLowerCase();
}

/**
 * Get a provider by type with fallback logic
 * Main orchestrator - delegates to specialized functions
 * Complexity: ~8 (reduced from 24)
 */
export async function getProvider(config: ProviderLookupConfig): Promise<SearchProvider> {
  const { providers, providerStates, defaultProvider, log, type, initialized, initialize } = config;

  // Ensure basic initialization
  if (!initialized && initialize) {
    await initialize();
  }

  // Try to find requested provider
  if (type) {
    const requestedProvider = findProviderExact(providers, providerStates, log, type) ??
                              findProviderCaseInsensitive(providers, providerStates, type);

    if (requestedProvider) {
      return requestedProvider;
    }

    log.warn('Provider not found or disabled', { requested: type });
  }

  // Fallback logic
  const fallbackProvider = getFallbackProvider(providers, providerStates, defaultProvider);
  if (fallbackProvider) {
    return fallbackProvider;
  }

  // Last resort: first enabled provider
  const firstEnabled = getFirstEnabledProvider(providers, providerStates);
  if (firstEnabled) {
    return firstEnabled;
  }

  throw new ValidationError('No enabled providers available');
}

/**
 * Find provider by exact type match
 * Complexity: ~4
 */
function findProviderExact(
  providers: Map<string, SearchProvider>,
  providerStates: Map<string, ProviderState>,
  log: Logger,
  type: string
): SearchProvider | undefined {
  if (!providers.has(type)) {
    return undefined;
  }

  const state = providerStates.get(type);
  if (!state?.enabled) {
    log.warn('Requested provider is disabled', { provider: type });
    return undefined;
  }

  return providers.get(type);
}

/**
 * Find provider by case-insensitive type match
 * Complexity: ~4
 */
function findProviderCaseInsensitive(
  providers: Map<string, SearchProvider>,
  providerStates: Map<string, ProviderState>,
  type: string
): SearchProvider | undefined {
  const normalizedType = normalizeProviderType(type);

  for (const [key, provider] of providers) {
    if (normalizeProviderType(key) === normalizedType) {
      const state = providerStates.get(key);
      if (state?.enabled) {
        return provider;
      }
    }
  }

  return undefined;
}

/**
 * Get fallback provider (default or AniList)
 * Complexity: ~6
 */
function getFallbackProvider(
  providers: Map<string, SearchProvider>,
  providerStates: Map<string, ProviderState>,
  defaultProvider: string
): SearchProvider | undefined {
  // Try default provider
  if (defaultProvider && providers.has(defaultProvider)) {
    const state = providerStates.get(defaultProvider);
    if (state?.enabled) {
      const provider = providers.get(defaultProvider);
      if (provider !== undefined) {
        return provider;
      }
    }
  }

  // Try AniList as preferred fallback
  if (providers.has(MetadataProvider.ANILIST)) {
    const state = providerStates.get(MetadataProvider.ANILIST);
    if (state?.enabled) {
      const provider = providers.get(MetadataProvider.ANILIST);
      if (provider !== undefined) {
        return provider;
      }
    }
  }

  return undefined;
}

/**
 * Get first enabled provider by priority
 * Complexity: ~3
 */
function getFirstEnabledProvider(
  providers: Map<string, SearchProvider>,
  providerStates: Map<string, ProviderState>
): SearchProvider | undefined {
  const sortedProviders = Array.from(providerStates.entries())
    .filter(([_, state]) => state.enabled)
    .sort((a, b) => a[1].priority - b[1].priority);

  if (sortedProviders.length > 0) {
    const firstEntry = sortedProviders[0];
    if (firstEntry !== undefined) {
      const [firstType] = firstEntry;
      return providers.get(firstType);
    }
  }

  return undefined;
}
