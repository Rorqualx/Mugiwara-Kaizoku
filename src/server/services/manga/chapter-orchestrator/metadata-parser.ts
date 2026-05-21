/**
 * Metadata Parsing Helpers
 * Parses provider metadata from various input formats
 */

import { logger } from '@/utils/logger';

import { isRawProviderData, isProviderMetadataRecord } from './type-guards';

import type { ProviderMetadataRecord } from './types';

/**
 * Parse provider metadata from rawProviderData
 * Complexity: 5
 */
export function parseRawProviderData(
  rawProviderData: unknown
): ProviderMetadataRecord | null {
  if (!rawProviderData) {
    return null;
  }

  const rawData: unknown = typeof rawProviderData === 'string'
    ? JSON.parse(rawProviderData) as unknown
    : rawProviderData;

  if (isRawProviderData(rawData) && isProviderMetadataRecord(rawData.metadata)) {
    logger.info('[chapterOrchestrator] Using providerMetadata from rawProviderData (wizard import)');
    return rawData.metadata;
  }

  return null;
}

/**
 * Parse provider metadata from direct input
 * Complexity: 4
 */
export function parseDirectProviderMetadata(
  providerMetadata: unknown
): ProviderMetadataRecord | null {
  if (!providerMetadata || !isProviderMetadataRecord(providerMetadata)) {
    return null;
  }

  logger.info('[chapterOrchestrator] Using providerMetadata from input (fallback)');
  return providerMetadata as ProviderMetadataRecord;
}

/**
 * Get provider metadata from input (tries multiple sources)
 * Complexity: 5
 */
export function getProviderMetadata(input: {
  rawProviderData?: unknown;
  providerMetadata?: unknown;
}): ProviderMetadataRecord | null {
  // PRIORITY 1: Check rawProviderData.metadata (wizard import data)
  const fromRawData = parseRawProviderData(input.rawProviderData);
  if (fromRawData) {
    return fromRawData;
  }

  // PRIORITY 2: Fallback to input.providerMetadata
  return parseDirectProviderMetadata(input.providerMetadata);
}
