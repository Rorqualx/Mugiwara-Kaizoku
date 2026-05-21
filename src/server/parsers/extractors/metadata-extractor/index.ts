/**
 * Metadata Extractor Module
 *
 * Exports the MetadataExtractor class and related types for extracting
 * structured metadata from wiki pages.
 *
 * Example usage:
 * ```typescript
 * import { MetadataExtractor, ExtractedMetadata } from './metadata-extractor';
 *
 * const extractor = new MetadataExtractor();
 * const metadata = extractor.extractMetadata($);
 * ```
 */

// Main class
export { MetadataExtractor } from './core';

// Types
export type {
  ExtractedMetadata,
  FieldMapping,
  MetadataExtractionOptions,
  CheerioElement,
} from './types';

// Utility functions (for advanced usage)
export {
  cleanTitle,
  splitNames,
  splitMultiValue,
  splitGenres,
  cleanPublisher,
  normalizeDemographic,
  normalizeStatus,
  normalizeDate,
  extractDate,
  extractNumber,
  extractUrl,
  extractISBNs,
  extractPersons,
  cleanText,
  isValidStatus,
  normalizeGenres,
  extractNumberRange,
  validateMetadata,
  isValidDate,
  parseOriginalRun,
  findFieldMapping,
  fieldMappings,
} from './utils';

// Individual extractors
export { extractFromSchema, extractFromSchemaData } from './schema-extractor';
export {
  extractFromInfobox,
  extractFromPortableInfobox,
  extractFromTraditionalInfobox,
} from './infobox-extractor';
export { extractFromMetaTags, extractFromContent } from './content-extractor';
