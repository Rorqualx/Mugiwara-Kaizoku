/**
 * Unified Provider Registry Utilities
 *
 * Helper functions for provider type detection, error classification,
 * and string normalization.
 *
 * Extracted from: UnifiedProviderRegistry.ts (lines 399-429, 703-707)
 */

import { MetadataProvider } from '@prisma/client';

import type { SearchProvider } from '../types';

/**
 * Provider error types
 */
export type ProviderErrorType = 'api_down' | 'rate_limit' | 'network' | 'auth' | 'unknown';

/**
 * Search provider with optional type field
 */
export type SearchProviderWithType = SearchProvider & {
  type?: string;
};

/**
 * Detect error type from error message
 * Analyzes error messages to classify the type of failure
 *
 * @param error - The error to classify
 * @returns The classified error type
 */
export function detectErrorType(error: unknown): ProviderErrorType {
  const errorMessage = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  if (errorMessage.includes('api has been temporarily disabled') ||
      errorMessage.includes('service unavailable') ||
      errorMessage.includes('503') ||
      errorMessage.includes('502')) {
    return 'api_down';
  }

  if (errorMessage.includes('rate limit') ||
      errorMessage.includes('too many requests') ||
      errorMessage.includes('429')) {
    return 'rate_limit';
  }

  if (errorMessage.includes('network') ||
      errorMessage.includes('fetch failed') ||
      errorMessage.includes('econnrefused') ||
      errorMessage.includes('timeout')) {
    return 'network';
  }

  if (errorMessage.includes('unauthorized') ||
      errorMessage.includes('401') ||
      errorMessage.includes('api key')) {
    return 'auth';
  }

  return 'unknown';
}

/**
 * Check if a provider is Fandom
 * Performs case-insensitive comparison against Fandom identifiers
 *
 * @param type - The provider type string to check
 * @returns True if the provider is Fandom
 */
export function isFandomProvider(type: string): boolean {
  const normalized = type.toLowerCase();
  return normalized === 'fandom' ||
         normalized === MetadataProvider.FANDOM.toLowerCase();
}

/**
 * Normalize provider type for case-insensitive comparison
 * Converts to lowercase and trims whitespace
 *
 * @param type - The provider type to normalize
 * @returns Normalized provider type string
 */
export function normalizeProviderType(type: string): string {
  return type.toLowerCase().trim();
}

/**
 * Get provider type name from SearchProvider
 * Returns type if available, falls back to name
 *
 * @param provider - The search provider
 * @returns The provider type name
 */
export function getProviderTypeName(provider: SearchProviderWithType): string {
  return provider.type ?? provider.name;
}
