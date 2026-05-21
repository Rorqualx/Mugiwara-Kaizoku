/**
 * Utility functions for Prowlarr Indexers Settings
 *
 * Contains helper functions for processing indexers, handling errors,
 * and other utility operations used by the indexers settings page.
 *
 * @module pages/settings/indexers/utils
 */

import { logger } from '@/utils/logger';

import type { UIIndexer, ProwlarrError, ProwlarrErrorDetail } from '../types';

/**
 * Processes raw indexer data from Prowlarr API
 * Adds UI-specific properties and handles malformed data
 *
 * @param data - Raw indexer data from Prowlarr API
 * @returns Processed UI indexers array
 */
export function processIndexersData(data: unknown): UIIndexer[] {
  if (!Array.isArray(data)) {
    logger.warn('Prowlarr API returned non-array data for indexers', { data });
    return [];
  }

  return data.map((indexer: unknown): UIIndexer => {
    if (typeof indexer !== 'object' || indexer === null) {
      logger.warn('Invalid indexer data found', { indexer });
      return createDefaultIndexer();
    }

    return {
      ...(indexer as UIIndexer),
      isPending: false // Reset loading states
    };
  });
}

/**
 * Creates a default indexer object for fallback
 * Used when indexer data is malformed or missing
 *
 * @returns Default UIIndexer object
 */
export function createDefaultIndexer(): UIIndexer {
  return {
    id: 0,
    name: '',
    enabled: false,
    priority: 0,
    implementation: '',
    implementationName: '',
    protocol: 'torrent',
    fields: [],
    tags: [],
    capabilities: {},
    configContract: '',
    isPending: false
  };
}

/**
 * Extracts user-friendly error message from Prowlarr error
 * Handles different error structures and formats
 *
 * @param error - Prowlarr error object
 * @returns User-friendly error message
 */
export function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  const prowlarrError = error as ProwlarrError;

  // Try to extract detailed error messages first
  if (prowlarrError.details && Array.isArray(prowlarrError.details)) {
    const errorMessages = prowlarrError.details
      .filter((detail: ProwlarrErrorDetail) => detail.errorMessage)
      .map((detail: ProwlarrErrorDetail) => detail.errorMessage);

    if (errorMessages.length > 0) {
      return errorMessages.join('. ');
    }
  }

  // Fall back to general error message
  if (prowlarrError.message) {
    return prowlarrError.message;
  }

  if (prowlarrError.errorMessage) {
    return prowlarrError.errorMessage;
  }

  return 'Unknown error occurred';
}

/**
 * Normalizes Prowlarr base URL by removing trailing slash
 * Ensures consistent URL format for API calls
 *
 * @param baseURL - Raw base URL input
 * @returns Normalized base URL without trailing slash
 */
export function normalizeBaseURL(baseURL: string): string {
  return baseURL.endsWith('/') ? baseURL.slice(0, -1) : baseURL;
}

/**
 * Determines if an indexer is enabled.
 *
 * @param indexer - UI indexer object
 * @returns True if the indexer is enabled
 */
export function isIndexerEnabled(indexer: UIIndexer): boolean {
  return indexer.enabled;
}

/**
 * Validates Prowlarr configuration
 * Checks if required fields are present and properly formatted
 *
 * @param baseURL - Prowlarr base URL
 * @param apiKey - Prowlarr API key
 * @returns Object with validation result and error message
 */
export function validateProwlarrConfig(baseURL: string, apiKey: string): { isValid: boolean; error?: string } {
  if (!baseURL || !apiKey) {
    return { isValid: false, error: 'Prowlarr URL and API key are required' };
  }

  if (!baseURL.startsWith('http://') && !baseURL.startsWith('https://')) {
    return { isValid: false, error: 'Prowlarr URL must start with http:// or https://' };
  }

  return { isValid: true };
}

/**
 * Generates helpful context for indexer errors
 * Provides user-friendly explanations for common error patterns
 *
 * @param error - Error message
 * @returns Help text for the specific error type
 */
export function getErrorHelpText(error: string): string | null {
  if (error.includes('CloudFlare')) {
    return 'CloudFlare protection prevents automated access to this indexer.';
  }

  if (error.includes('authentication')) {
    return 'You may need to configure credentials for this indexer in Prowlarr.';
  }

  if (error.includes('blocking access') || error.includes('Forbidden')) {
    return 'The indexer may have blocked Prowlarr\'s IP address or require authentication.';
  }

  if (error.includes('unavailable')) {
    return 'Try again later when the indexer might be back online.';
  }

  return null;
}