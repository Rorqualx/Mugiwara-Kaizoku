/**
 * Dynamic Confidence Calculator
 *
 * Calculates multi-factor confidence scores for metadata field values
 * based on actual data quality rather than hardcoded provider rankings.
 *
 * @module lib/confidence/dynamic-confidence-calculator
 */

import { FIELD_QUALITY_MATRIX } from '@/types/search-types/unified-metadata-schema';

import { DEFAULT_CONFIDENCE_WEIGHTS } from './types';

import type {
  FieldConfidenceContext,
  QualitySignals,
  DynamicConfidenceResult,
  ConfidenceWeights,
  ProviderQualityBaseline,
} from './types';

// ============================================================================
// Field Completeness Calculation (25%)
// ============================================================================

/**
 * Calculate field completeness based on field-specific criteria
 */
// eslint-disable-next-line complexity -- Switch-case routing to field-specific calculators; complexity from number of field types, not logic depth
export function calculateFieldCompleteness(field: string, value: unknown): number {
  // Short-circuit for null/undefined/empty
  if (value === null || value === undefined) return 0;
  if (typeof value === 'string' && value.trim() === '') return 0;

  switch (field) {
    case 'title':
      return calculateTitleCompleteness(value);
    case 'description':
    case 'synopsis':
      return calculateDescriptionCompleteness(value);
    case 'cover':
    case 'coverImage':
    case 'bannerImage':
      return calculateImageCompleteness(value);
    case 'volumes':
    case 'chapters':
      return calculateNumericCompleteness(value);
    case 'genres':
    case 'tags':
    case 'themes':
    case 'authors':
    case 'artists':
    case 'alternativeTitles':
    case 'characters':
    case 'staff':
      return calculateArrayCompleteness(value);
    case 'status':
    case 'format':
    case 'demographic':
    case 'countryOfOrigin':
      return calculateEnumCompleteness(value);
    default:
      return calculateDefaultCompleteness(value);
  }
}

function calculateTitleCompleteness(value: unknown): number {
  if (typeof value !== 'string') return 0;
  const len = value.trim().length;
  if (len === 0) return 0;
  if (len < 2) return 20;
  if (len < 5) return 60;
  return 100;
}

function calculateDescriptionCompleteness(value: unknown): number {
  if (typeof value !== 'string') return 0;
  const len = value.trim().length;
  if (len === 0) return 0;
  if (len < 20) return 30;
  if (len < 100) return 60;
  if (len < 200) return 80;
  return 100;
}

function calculateImageCompleteness(value: unknown): number {
  if (typeof value !== 'string') return 0;
  const url = value.trim();
  if (url === '') return 0;

  // Check for valid URL structure
  try {
    new URL(url);
  } catch {
    return 20; // Invalid URL structure
  }

  // Check for placeholder images
  const placeholderPatterns = [
    /placeholder/i,
    /no-image/i,
    /noimage/i,
    /default/i,
    /missing/i,
  ];
  if (placeholderPatterns.some(pattern => pattern.test(url))) {
    return 10;
  }

  return 100;
}

function calculateNumericCompleteness(value: unknown): number {
  let numValue: number;

  if (typeof value === 'number') {
    numValue = value;
  } else if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) return 0;
    numValue = parsed;
  } else {
    return 0;
  }

  if (numValue <= 0) return 0;
  if (numValue > 10000) return 50; // Suspicious high values
  return 100;
}

function calculateArrayCompleteness(value: unknown): number {
  if (!Array.isArray(value)) return 0;
  if (value.length === 0) return 0;
  if (value.length === 1) return 60;
  if (value.length === 2) return 80;
  return 100;
}

function calculateEnumCompleteness(value: unknown): number {
  if (typeof value !== 'string') return 0;
  const val = value.trim();
  if (val === '' || val === 'UNKNOWN' || val === 'unknown') return 0;
  return 100;
}

function calculateDefaultCompleteness(value: unknown): number {
  if (typeof value === 'string') {
    return value.trim().length > 0 ? 100 : 0;
  }
  if (typeof value === 'number') {
    return value !== 0 ? 100 : 50;
  }
  if (typeof value === 'boolean') {
    return 100;
  }
  if (Array.isArray(value)) {
    return value.length > 0 ? 100 : 0;
  }
  if (typeof value === 'object' && value !== null) {
    return Object.keys(value).length > 0 ? 100 : 0;
  }
  return 0;
}

// ============================================================================
// Content Quality Calculation (25%)
// ============================================================================

/**
 * Calculate content quality based on richness and validity of data
 */
export function calculateContentQuality(field: string, value: unknown): number {
  if (value === null || value === undefined) return 0;

  switch (field) {
    case 'description':
    case 'synopsis':
      return calculateDescriptionQuality(value);
    case 'cover':
    case 'coverImage':
    case 'bannerImage':
      return calculateImageQuality(value);
    case 'genres':
    case 'tags':
    case 'themes':
    case 'authors':
    case 'artists':
    case 'characters':
    case 'staff':
      return calculateArrayQuality(value);
    default:
      return calculateDefaultQuality(value);
  }
}

function calculateDescriptionQuality(value: unknown): number {
  if (typeof value !== 'string') return 0;

  const text = value.trim();
  if (text === '') return 0;

  let score = 50; // Base score

  // Length bonuses
  if (text.length > 100) score += 10;
  if (text.length > 300) score += 10;
  if (text.length > 500) score += 10;

  // Structure bonuses
  if (/<[^>]+>/.test(text)) score += 5; // Has HTML (likely formatted)
  if (/\n\n|\r\n\r\n/.test(text) || /<p>/i.test(text)) score += 5; // Has paragraphs

  // Quality penalties
  const noDescPatterns = [
    /no description/i,
    /no synopsis/i,
    /description unavailable/i,
    /^n\/a$/i,
    /^tba$/i,
    /^tbd$/i,
  ];
  if (noDescPatterns.some(pattern => pattern.test(text))) {
    return Math.max(0, score - 30);
  }

  return Math.min(100, Math.max(0, score));
}

function calculateImageQuality(value: unknown): number {
  if (typeof value !== 'string') return 0;

  const url = value.trim();
  if (url === '') return 0;

  let score = 70; // Base score for valid URLs

  // Quality host bonuses
  const qualityHosts = [
    /anilist\.co/i,
    /myanimelist\.net/i,
    /kitsu\.io/i,
    /mangadex\.org/i,
    /comicvine\.gamespot\.com/i,
    /static\.wikia\.nocookie\.net/i,
  ];
  if (qualityHosts.some(pattern => pattern.test(url))) {
    score += 15;
  }

  // HTTPS bonus
  if (url.startsWith('https://')) {
    score += 5;
  }

  // Size indicator bonuses
  if (/large|original|full|hq/i.test(url)) {
    score += 10;
  }

  return Math.min(100, Math.max(0, score));
}

function calculateArrayQuality(value: unknown): number {
  if (!Array.isArray(value)) return 0;
  if (value.length === 0) return 0;

  let score = 50; // Base score

  // Length bonuses
  if (value.length >= 3) score += 15;
  if (value.length >= 5) score += 15;

  // Rich data bonus (objects with properties vs flat strings)
  const hasRichData = value.some((item: unknown) => {
    if (typeof item !== 'object' || item === null) return false;
    const obj = item as Record<string, unknown>;
    return Object.keys(obj).length > 1;
  });
  if (hasRichData) score += 20;

  return Math.min(100, Math.max(0, score));
}

function calculateDefaultQuality(value: unknown): number {
  if (typeof value === 'string') {
    return value.trim().length > 0 ? 70 : 0;
  }
  if (typeof value === 'number') {
    return value > 0 ? 80 : 50;
  }
  if (typeof value === 'boolean') {
    return 80;
  }
  if (Array.isArray(value)) {
    return value.length > 0 ? 70 : 0;
  }
  return 50;
}

// ============================================================================
// Provider Base Calculation (20%)
// ============================================================================

/**
 * Get provider baseline from FIELD_QUALITY_MATRIX
 */
export function getProviderBaseline(field: string, provider: string): ProviderQualityBaseline {
  const normalizedProvider = provider.toLowerCase();
  const providerQuality = FIELD_QUALITY_MATRIX[field]?.[normalizedProvider];

  if (providerQuality) {
    return providerQuality;
  }

  // Default baseline for unknown field/provider combinations
  return { quality: 50, confidence: 50 };
}

/**
 * Calculate provider base score from FIELD_QUALITY_MATRIX
 */
export function calculateProviderBase(field: string, provider: string): number {
  const baseline = getProviderBaseline(field, provider);
  // Average of quality and confidence scores
  return (baseline.quality + baseline.confidence) / 2;
}

// ============================================================================
// Data Consistency Calculation (15%)
// ============================================================================

/**
 * Calculate how consistent this value is with other providers' values
 */
export function calculateDataConsistency(
  field: string,
  value: unknown,
  provider: string,
  allProviderData?: Record<string, Record<string, unknown>>
): number {
  // If no other provider data available, return neutral score
  if (!allProviderData || Object.keys(allProviderData).length <= 1) {
    return 75;
  }

  // Get values from other providers for the same field
  const otherValues: unknown[] = [];
  for (const [providerName, data] of Object.entries(allProviderData)) {
    if (providerName.toLowerCase() === provider.toLowerCase()) continue;
    if (field in data) {
      otherValues.push(data[field]);
    }
  }

  if (otherValues.length === 0) {
    return 75; // No comparison data
  }

  // Field-specific consistency checks
  if (typeof value === 'number') {
    return calculateNumericConsistency(value, otherValues);
  }

  if (field === 'status') {
    return calculateEnumConsistency(value, otherValues);
  }

  if (Array.isArray(value)) {
    return calculateArrayConsistency(value, otherValues);
  }

  // Default: basic string/object comparison
  return calculateDefaultConsistency(value, otherValues);
}

function calculateNumericConsistency(value: number, otherValues: unknown[]): number {
  const otherNumbers = otherValues
    .filter((v): v is number => typeof v === 'number' && v > 0);

  if (otherNumbers.length === 0) return 75;

  // Calculate how close this value is to others
  const avg = otherNumbers.reduce((sum, n) => sum + n, 0) / otherNumbers.length;
  const percentDiff = Math.abs(value - avg) / Math.max(avg, 1);

  if (percentDiff <= 0.1) return 100; // Within 10%
  if (percentDiff <= 0.25) return 80; // Within 25%
  if (percentDiff <= 0.5) return 60; // Within 50%
  return 40; // More than 50% different
}

function calculateEnumConsistency(value: unknown, otherValues: unknown[]): number {
  if (typeof value !== 'string') return 50;

  const normalizedValue = value.toLowerCase();
  const matches = otherValues.some(
    other => typeof other === 'string' && other.toLowerCase() === normalizedValue
  );

  return matches ? 100 : 50;
}

function calculateArrayConsistency(value: unknown[], otherValues: unknown[]): number {
  const otherArrays = otherValues.filter(Array.isArray);
  if (otherArrays.length === 0) return 75;

  // Normalize values for comparison
  const normalizeItem = (item: unknown): string => {
    if (typeof item === 'string') return item.toLowerCase();
    if (typeof item === 'object' && item !== null) {
      const obj = item as Record<string, unknown>;
      return String(obj['name'] ?? obj['label'] ?? item).toLowerCase();
    }
    return String(item).toLowerCase();
  };

  const valueSet = new Set(value.map(normalizeItem));

  // Calculate Jaccard similarity with each other provider
  const similarities = otherArrays.map(other => {
    const otherSet = new Set(other.map(normalizeItem));
    const intersection = new Set([...valueSet].filter(x => otherSet.has(x)));
    const union = new Set([...valueSet, ...otherSet]);
    return union.size > 0 ? intersection.size / union.size : 0;
  });

  // Average similarity
  const avgSimilarity = similarities.reduce((sum, s) => sum + s, 0) / similarities.length;
  return Math.round(avgSimilarity * 100);
}

function calculateDefaultConsistency(value: unknown, otherValues: unknown[]): number {
  // Simple equality check for strings
  if (typeof value === 'string') {
    const normalizedValue = value.toLowerCase();
    const matches = otherValues.filter(
      other => typeof other === 'string' && other.toLowerCase() === normalizedValue
    ).length;
    return matches > 0 ? 80 + Math.min(matches * 10, 20) : 60;
  }

  return 70; // Neutral for complex objects
}

// ============================================================================
// Rich Data Score Calculation (15%)
// ============================================================================

/**
 * Calculate how rich/structured the data is
 */
export function calculateRichDataScore(value: unknown): number {
  if (value === null || value === undefined) return 0;

  // Primitives: basic score
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return 50;
  }

  // Arrays
  if (Array.isArray(value)) {
    if (value.length === 0) return 0;

    // Check if array contains objects with properties
    const hasObjects = value.some((item: unknown) => typeof item === 'object' && item !== null);
    if (!hasObjects) return 50; // Flat array of primitives

    // Score based on object richness
    let score = 60; // Base score for object arrays
    const sampleItem = value.find((item: unknown) => typeof item === 'object' && item !== null);
    if (sampleItem && typeof sampleItem === 'object') {
      const sampleObj = sampleItem as Record<string, unknown>;
      const keys = Object.keys(sampleObj);
      if (keys.includes('id')) score += 10;
      if (keys.includes('name')) score += 5;
      if (keys.includes('description')) score += 10;
      if (keys.includes('url')) score += 5;
      if (keys.includes('role')) score += 10;
    }

    return Math.min(100, score);
  }

  // Objects (null already checked at function start)
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);
    if (keys.length === 0) return 0;
    if (keys.length <= 2) return 60;
    if (keys.length <= 4) return 80;
    return 100;
  }

  return 50;
}

// ============================================================================
// Main Confidence Calculation
// ============================================================================

/**
 * Calculate dynamic confidence score using multi-factor analysis
 */
export function calculateDynamicConfidence(
  context: FieldConfidenceContext,
  weights: ConfidenceWeights = DEFAULT_CONFIDENCE_WEIGHTS
): DynamicConfidenceResult {
  const { field, value, provider, allProviderData } = context;

  // Short-circuit for null/undefined/empty
  if (value === null || value === undefined) {
    return {
      confidence: 0,
      signals: {
        fieldCompleteness: 0,
        contentQuality: 0,
        providerBase: 0,
        dataConsistency: 0,
        richDataScore: 0,
      },
    };
  }

  // Calculate individual signals
  const signals: QualitySignals = {
    fieldCompleteness: calculateFieldCompleteness(field, value),
    contentQuality: calculateContentQuality(field, value),
    providerBase: calculateProviderBase(field, provider),
    dataConsistency: calculateDataConsistency(field, value, provider, allProviderData),
    richDataScore: calculateRichDataScore(value),
  };

  // Short-circuit if field is empty
  if (signals.fieldCompleteness === 0) {
    return {
      confidence: 0,
      signals,
    };
  }

  // Calculate weighted confidence
  const confidence = Math.round(
    weights.fieldCompleteness * signals.fieldCompleteness +
    weights.contentQuality * signals.contentQuality +
    weights.providerBase * signals.providerBase +
    weights.dataConsistency * signals.dataConsistency +
    weights.richDataScore * signals.richDataScore
  );

  return {
    confidence: Math.max(0, Math.min(100, confidence)),
    signals,
  };
}
