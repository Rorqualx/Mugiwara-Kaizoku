/**
 * Column Type Classification
 *
 * Infers entity types from table column headers and sample values.
 */

import type { EntityType } from '@/server/ml/features/bio-types';

export interface ColumnClassification {
  entityType: EntityType | null;
  confidence: number;
}

interface HeaderPattern {
  pattern: RegExp;
  entityType: EntityType;
  confidence: number;
}

/**
 * Header patterns for chapter tables
 */
const CHAPTER_HEADER_PATTERNS: HeaderPattern[] = [
  { pattern: /^#$|^no\.?$/i, entityType: 'CHAPTER_COUNT', confidence: 0.9 },
  { pattern: /^chapter$/i, entityType: 'CHAPTER_TITLE', confidence: 0.95 },
  { pattern: /^title$/i, entityType: 'CHAPTER_TITLE', confidence: 0.8 },
  { pattern: /^name$/i, entityType: 'CHAPTER_TITLE', confidence: 0.7 },
  { pattern: /^release|^date|^published$/i, entityType: 'CHAPTER_RELEASE_DATE', confidence: 0.9 },
  { pattern: /^pages?$/i, entityType: 'CHAPTER_COUNT', confidence: 0.6 },
  { pattern: /^summary|^synopsis$/i, entityType: 'CHAPTER_SUMMARY', confidence: 0.85 },
];

/**
 * Header patterns for volume tables
 */
const VOLUME_HEADER_PATTERNS: HeaderPattern[] = [
  { pattern: /^volume$/i, entityType: 'VOLUME_TITLE', confidence: 0.95 },
  { pattern: /^#$|^no\.?$/i, entityType: 'VOLUME_COUNT', confidence: 0.9 },
  { pattern: /^title$/i, entityType: 'VOLUME_TITLE', confidence: 0.8 },
  { pattern: /^name$/i, entityType: 'VOLUME_TITLE', confidence: 0.7 },
  { pattern: /^release|^date|^published$/i, entityType: 'VOLUME_RELEASE_DATE', confidence: 0.9 },
  { pattern: /^isbn$/i, entityType: 'ISBN', confidence: 0.9 },
  { pattern: /^chapters?$/i, entityType: 'CHAPTER_COUNT', confidence: 0.8 },
  { pattern: /^cover$/i, entityType: 'VOLUME_COVER', confidence: 0.9 },
  { pattern: /^summary|^synopsis$/i, entityType: 'VOLUME_SUMMARY', confidence: 0.85 },
];

/**
 * Value patterns for validation
 */
const VALUE_PATTERNS = {
  isNumeric: /^\d+$/,
  isDate: /^\d{4}[-/]\d{1,2}[-/]\d{1,2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i,
  isChapterNumber: /^(?:Ch\.?\s*)?\d+(?:\.\d+)?$/i,
  isVolumeNumber: /^(?:Vol\.?\s*)?\d+$/i,
  isISBN: /^\d{10}|\d{13}|[\dX-]+$/i,
};

/**
 * Classify a column by its header text
 */
export function classifyColumnByHeader(
  headerText: string,
  tableType: 'chapter' | 'volume'
): ColumnClassification {
  const patterns = tableType === 'chapter' ? CHAPTER_HEADER_PATTERNS : VOLUME_HEADER_PATTERNS;
  const normalized = headerText.trim().toLowerCase();

  for (const { pattern, entityType, confidence } of patterns) {
    if (pattern.test(normalized)) {
      return { entityType, confidence };
    }
  }

  return { entityType: null, confidence: 0 };
}

/**
 * Validate column type with sample values
 * Returns adjusted confidence based on value patterns
 */
export function validateColumnTypeWithValues(
  inferredType: EntityType,
  sampleValues: string[]
): number {
  if (sampleValues.length === 0) return 0.5;

  let matchingValues = 0;

  for (const value of sampleValues) {
    const trimmed = value.trim();
    if (isValueMatchingType(trimmed, inferredType)) {
      matchingValues++;
    }
  }

  const matchRatio = matchingValues / sampleValues.length;
  // Adjust confidence: full match = 1.0, no match = 0.3
  return 0.3 + matchRatio * 0.7;
}

/**
 * Check if a value matches the expected pattern for an entity type
 */
function isValueMatchingType(value: string, entityType: EntityType): boolean {
  switch (entityType) {
    case 'CHAPTER_COUNT':
    case 'VOLUME_COUNT':
      return VALUE_PATTERNS.isNumeric.test(value) || VALUE_PATTERNS.isChapterNumber.test(value);

    case 'CHAPTER_RELEASE_DATE':
    case 'VOLUME_RELEASE_DATE':
    case 'RELEASE_DATE':
      return VALUE_PATTERNS.isDate.test(value);

    case 'CHAPTER_TITLE':
    case 'VOLUME_TITLE':
      // Titles are text - just check it's not empty and not purely numeric
      return value.length > 0 && !VALUE_PATTERNS.isNumeric.test(value);

    default:
      return true; // Allow any value for unknown types
  }
}

/**
 * Get the best classification for a column considering both header and values
 */
export function classifyColumn(
  headerText: string,
  sampleValues: string[],
  tableType: 'chapter' | 'volume'
): ColumnClassification {
  const headerClassification = classifyColumnByHeader(headerText, tableType);

  if (!headerClassification.entityType) {
    return { entityType: null, confidence: 0 };
  }

  const valueConfidence = validateColumnTypeWithValues(
    headerClassification.entityType,
    sampleValues
  );

  // Combine header and value confidence
  const finalConfidence = headerClassification.confidence * 0.6 + valueConfidence * 0.4;

  return {
    entityType: headerClassification.entityType,
    confidence: finalConfidence,
  };
}
