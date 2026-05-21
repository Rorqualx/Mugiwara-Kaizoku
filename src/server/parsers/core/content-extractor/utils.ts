/**
 * Content Extractor Utilities
 *
 * Shared utility functions for content extraction.
 *
 * Extracted from: ContentExtractor.ts (lines 520-555)
 * Date: 2025-11-21
 */

import type { DetectedFormat } from '../FormatDetector';

/**
 * Normalize URL (handle protocol-relative and relative URLs)
 */
export function normalizeUrl(url: string): string {
  if (!url) return '';

  // Handle protocol-relative URLs
  if (url.startsWith('//')) {
    return 'https:' + url;
  }

  // Handle relative URLs (this should be resolved with base URL in actual usage)
  if (url.startsWith('/')) {
    return url; // Caller should resolve with base URL
  }

  return url;
}

/**
 * Create default format structure
 */
export function createDefaultFormat(hint?: string): DetectedFormat {
  return {
    primary: {
      name: hint ?? 'generic',
      priority: 100,
      detect: () => true,
      features: {}
    },
    alternatives: [],
    features: {},
    confidence: 0.5,
    signals: ['default']
  };
}
