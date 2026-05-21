/**
 * Dynamic Confidence System
 *
 * Provides multi-factor confidence calculation for metadata field values
 * based on actual data quality rather than hardcoded provider rankings.
 *
 * @module lib/confidence
 *
 * @example
 * ```typescript
 * // Simple usage - returns 0-100 score
 * import { getFieldConfidence } from '@/lib/confidence';
 * const confidence = getFieldConfidence('description', 'A long description...', 'anilist');
 *
 * // Full breakdown with signals
 * import { calculateConfidence } from '@/lib/confidence';
 * const result = calculateConfidence({
 *   field: 'description',
 *   value: 'A long description...',
 *   provider: 'anilist',
 *   allProviderData: { anilist: {...}, comicvine: {...} }
 * });
 * // result.confidence = 85
 * // result.signals = { fieldCompleteness, contentQuality, ... }
 * ```
 */

// Types
export type {
  QualitySignals,
  FieldConfidenceContext,
  DynamicConfidenceResult,
  ConfidenceWeights,
  ConfidenceServiceConfig,
  CachedConfidenceEntry,
  ProviderQualityBaseline,
} from './types';

export {
  DEFAULT_CONFIDENCE_WEIGHTS,
  DEFAULT_SERVICE_CONFIG,
} from './types';

// Calculator functions
export {
  calculateFieldCompleteness,
  calculateContentQuality,
  calculateProviderBase,
  calculateDataConsistency,
  calculateRichDataScore,
  calculateDynamicConfidence,
  getProviderBaseline,
} from './dynamic-confidence-calculator';

// Service
export {
  getConfidenceService,
  createConfidenceService,
  resetConfidenceService,
  getFieldConfidence,
  calculateConfidence,
} from './confidence-service';
