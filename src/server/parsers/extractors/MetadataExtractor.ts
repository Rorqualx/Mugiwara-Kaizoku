/**
 * MetadataExtractor - Re-export wrapper for backward compatibility
 *
 * This file has been decomposed into focused modules.
 * Import from './metadata-extractor' for the full API.
 *
 * @deprecated Import directly from './metadata-extractor' instead
 */

export {
  // Main class
  MetadataExtractor,
  // Types
  type ExtractedMetadata,
  type FieldMapping,
  type MetadataExtractionOptions,
  type CheerioElement,
  // Utility functions
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
  // Individual extractors
  extractFromSchema,
  extractFromSchemaData,
  extractFromInfobox,
  extractFromPortableInfobox,
  extractFromTraditionalInfobox,
  extractFromMetaTags,
  extractFromContent,
} from './metadata-extractor';
