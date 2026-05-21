/**
 * URL extraction and logging utilities for Fandom provider
 */

import { logger } from '@/utils/logger';

import type { FandomMutations } from './types';

/**
 * Extract URL from nested object (metadata, rawData)
 */
function extractUrlFromNested(obj: unknown, urlFields: string[]): string | undefined {
  if (!obj || typeof obj !== 'object') return undefined;
  const record = obj as Record<string, unknown>;
  for (const field of urlFields) {
    const value = record[field];
    if (typeof value === 'string' && value.includes('fandom.com')) {
      return value;
    }
  }
  return undefined;
}

/**
 * Extract URL from externalLinks array
 */
function extractUrlFromExternalLinks(result: Record<string, unknown>): string | undefined {
  const externalLinks = result['externalLinks'] as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(externalLinks)) return undefined;

  for (const link of externalLinks) {
    const url = link['url'] as string | undefined;
    if (url && typeof url === 'string' && url.includes('fandom.com')) {
      return url;
    }
  }
  return undefined;
}

/**
 * Extract URL from result with fallback options
 * Checks multiple locations: direct properties, metadata, rawData, externalLinks
 */
export function extractUrl(result: Record<string, unknown>): string | undefined {
  const urlFields = ['url', 'wikiUrl', 'siteDetailUrl', 'link', 'providerUrl'];

  // 1. Check direct properties
  for (const field of urlFields) {
    const value = result[field];
    if (typeof value === 'string' && value.includes('fandom.com')) {
      return value;
    }
  }

  // 2. Check metadata object
  const metadataUrl = extractUrlFromNested(result['metadata'], urlFields);
  if (metadataUrl) return metadataUrl;

  // 3. Check rawData object
  const rawDataUrl = extractUrlFromNested(result['rawData'], urlFields);
  if (rawDataUrl) return rawDataUrl;

  // 4. Check externalLinks array
  const externalLinkUrl = extractUrlFromExternalLinks(result);
  if (externalLinkUrl) return externalLinkUrl;

  // Also check metadata.externalLinks
  const metadataExternalLinkUrl = extractUrlFromExternalLinks((result['metadata'] ?? {}) as Record<string, unknown>);
  if (metadataExternalLinkUrl) return metadataExternalLinkUrl;

  return undefined;
}

/**
 * Log Fandom metadata fetch attempt
 */
export function logFetchAttempt(result: Record<string, unknown>, mutations: FandomMutations, url: string | undefined): void {
  logger.info('[Fandom] fetchFandomMetadata called with:', {
    hasUrl: !!url,
    url,
    hasMetadata: !!result['metadata'],
    metadataKeys: result['metadata'] ? Object.keys(result['metadata'] as Record<string, unknown>) : [],
    volumes: result['volumes'] ?? (result['metadata'] as Record<string, unknown> | undefined)?.['volumes'],
    chapters: result['chapters'] ?? (result['metadata'] as Record<string, unknown> | undefined)?.['chapters'],
    hasParseFandomUrlMutation: !!mutations.parseFandomUrlMutation,
    allMutationKeys: Object.keys(mutations)
  });

  logger.info('[Fandom] fetchFandomMetadata - input result:', result);
  logger.info('[Fandom] fetchFandomMetadata - extracted URL:', url);
  logger.info('[Fandom] fetchFandomMetadata - mutations available:', Object.keys(mutations));
}
