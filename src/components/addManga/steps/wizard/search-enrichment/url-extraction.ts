/**
 * URL Extraction Utilities
 *
 * Helpers for extracting URLs from search results.
 */

import { isRecord } from '@/lib/type-guards';
import { logger } from '@/utils/logger';

/**
 * Extract Fandom URL from search result
 * URL can be in multiple locations: top-level, metadata, rawData, or metadata.raw
 */
export function extractFandomUrl(
  selectedResult: Record<string, unknown>
): string {
  // Check all possible locations for URL
  const metadataObj = isRecord(selectedResult['metadata']) ? selectedResult['metadata'] : undefined;
  const rawDataObj = isRecord(selectedResult['rawData']) ? selectedResult['rawData'] : undefined;
  const metadataRawObj = isRecord(metadataObj?.['raw']) ? metadataObj['raw'] as Record<string, unknown> : undefined;

  // Try to find URL in order of preference
  const urlCandidates = [
    // Top level
    selectedResult['url'],
    selectedResult['wikiUrl'],
    selectedResult['providerUrl'],
    // rawData (where URL actually is based on logs)
    rawDataObj?.['url'],
    rawDataObj?.['wikiUrl'],
    rawDataObj?.['siteDetailUrl'],
    // metadata
    metadataObj?.['url'],
    metadataObj?.['wikiUrl'],
    // metadata.raw
    metadataRawObj?.['url'],
    metadataRawObj?.['wikiUrl'],
    metadataRawObj?.['siteDetailUrl'],
  ];

  // Find first valid URL
  const extractedUrl = urlCandidates.find(
    (candidate): candidate is string => typeof candidate === 'string' && candidate.includes('fandom.com')
  ) ?? '';

  logger.info('[extractFandomUrl] Extracted URL', {
    extractedUrl,
    hasUrl: !!extractedUrl,
    checkedLocations: {
      topLevel: !!selectedResult['url'],
      rawData: !!rawDataObj?.['url'],
      metadata: !!metadataObj?.['url'],
      metadataRaw: !!metadataRawObj?.['url'],
    }
  });

  return extractedUrl;
}
