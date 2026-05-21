/**
 * ML Feature Extraction Module
 *
 * Exports all feature extraction utilities for the Transformer-CRF model.
 *
 * Note: For client-safe imports (types/constants only), use:
 * import { BIO_LABELS, type BIOTag } from '@/server/ml/features/bio-types';
 */

// Client-safe exports (no Node.js dependencies)
export { BIO_LABELS, getAllBIOTags, type EntityType, type BIOTag } from './bio-types';

// Server-only exports (require happy-dom/Node.js)
export {
  linearizeDOM,
  entitySpansToBIO,
  bioToEntitySpans,
  type LinearizedToken,
  type LinearizationResult,
  type LinearizationStats,
  type LinearizationOptions,
  type DOMLinearizationOptions,
} from './dom-linearizer';
