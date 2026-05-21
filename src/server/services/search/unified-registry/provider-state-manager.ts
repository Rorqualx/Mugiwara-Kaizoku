/**
 * Provider State Manager
 *
 * Handles provider state loading, persistence, and retrieval.
 * Manages enabled/disabled states from Config table.
 *
 * Extracted from: UnifiedProviderRegistry.ts (lines 196-308)
 */

import { MetadataProvider } from '@prisma/client';

import { logger } from '@/utils/logger';



import { normalizeProviderType } from './registry-utils';

import type { ProviderState } from './registry-types';

const log = logger.child('ProviderStateManager');

/**
 * Load default provider from configuration
 */
export async function loadDefaultProvider(): Promise<string | null> {
  // This would integrate with your config service
  // For now, return null to use default
  return Promise.resolve(null);
}

/**
 * Load provider states from Config table
 * Reads enabled states and API keys from database config
 */
export async function loadProviderStates(
  providerStates: Map<string, ProviderState>
): Promise<void> {
  try {
    // Import configReader to check Config table
    const { getConfigBoolean, getConfig } = await import('../../../utils/configReader');

    // Read all provider enabled states in parallel
    // IMPORTANT: Default all providers to TRUE so they show up in search
    const [anilistEnabled, comicvineEnabled, comicvineApiKey, fandomEnabled, wikipediaEnabled, mangadexEnabled] = await Promise.all([
      getConfigBoolean('anilist.enabled', true),
      getConfigBoolean('comicvine.enabled', false),
      getConfig('comicvine.apiKey'),
      getConfigBoolean('fandom.enabled', true),
      getConfigBoolean('wikipedia.enabled', true),
      getConfigBoolean('mangadex.enabled', true),
    ]);

    // Update provider states using MetadataProvider enum (UPPERCASE keys)
    // This matches how providers are registered in UnifiedProviderRegistry
    updateProviderState(providerStates, MetadataProvider.ANILIST, anilistEnabled);
    updateComicVineState(providerStates, comicvineEnabled, comicvineApiKey);
    updateProviderState(providerStates, MetadataProvider.FANDOM, fandomEnabled);
    updateProviderState(providerStates, MetadataProvider.WIKIPEDIA, wikipediaEnabled);
    updateProviderState(providerStates, MetadataProvider.MANGADEX, mangadexEnabled);

    log.info('Loaded provider states from Config table', {
      [MetadataProvider.ANILIST]: providerStates.get(MetadataProvider.ANILIST)?.enabled,
      [MetadataProvider.COMICVINE]: providerStates.get(MetadataProvider.COMICVINE)?.enabled,
      [MetadataProvider.FANDOM]: providerStates.get(MetadataProvider.FANDOM)?.enabled,
      [MetadataProvider.WIKIPEDIA]: providerStates.get(MetadataProvider.WIKIPEDIA)?.enabled,
      [MetadataProvider.MANGADEX]: providerStates.get(MetadataProvider.MANGADEX)?.enabled
    });
  } catch (error) {
    log.error('Failed to load provider states from Config table', { error });
    // Keep default states on error
  }
}

/**
 * Get the state of a specific provider
 * Performs case-insensitive matching
 */
export function getProviderState(
  providerStates: Map<string, ProviderState>,
  type: string
): ProviderState | undefined {
  // Check exact match first
  if (providerStates.has(type)) {
    return providerStates.get(type);
  }

  // Try case-insensitive match
  const normalizedType = normalizeProviderType(type);
  for (const [key, state] of Array.from(providerStates.entries())) {
    if (normalizeProviderType(key) === normalizedType) {
      return state;
    }
  }

  return undefined;
}

/**
 * Update provider state with enabled flag
 * Helper function to reduce duplication
 */
function updateProviderState(
  providerStates: Map<string, ProviderState>,
  provider: string,
  enabled: boolean
): void {
  const existingState = providerStates.get(provider);
  if (existingState !== undefined) {
    providerStates.set(provider, {
      ...existingState,
      enabled
    });
  }
}

/**
 * Update ComicVine state (requires API key check)
 * ComicVine needs both enabled flag AND valid API key
 */
function updateComicVineState(
  providerStates: Map<string, ProviderState>,
  comicvineEnabled: boolean,
  comicvineApiKey: string | null | undefined
): void {
  // Use MetadataProvider.COMICVINE (uppercase) to match registration key
  const existingState = providerStates.get(MetadataProvider.COMICVINE);
  if (existingState !== undefined) {
    // Check if API key is configured
    const shouldEnable = comicvineEnabled && !!comicvineApiKey;

    if (comicvineEnabled && !comicvineApiKey) {
      log.warn('ComicVine is enabled but no API key is configured');
    }

    providerStates.set(MetadataProvider.COMICVINE, {
      ...existingState,
      enabled: shouldEnable
    });
  }
}
