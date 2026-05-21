/**
 * Unified Image Processing Module
 *
 * Main aggregator for image processing utilities.
 * All functions re-exported for backward compatibility.
 *
 * Module Structure:
 * - types.ts - Type definitions (ImageInfo, ImageProcessingOptions, ImageSet)
 * - url-processing.ts - URL cleaning & resolution (2 functions)
 * - validation.ts - Image validation (5 functions)
 * - selection.ts - Image selection (2 functions)
 * - batch-processing.ts - Batch operations (2 functions)
 * - metadata.ts - Metadata extraction (3 functions)
 * - optimization.ts - CDN & optimization (3 functions)
 * - type-detection.ts - Type classification (1 function)
 *
 * Total: 21 exports across 8 modules
 * Original: 710 lines → Refactored: ~60 lines (92% reduction)
 *
 * All original function names preserved for backward compatibility.
 */

// ============================================================================
// Re-export All Modules
// ============================================================================

// Type definitions
export * from './types';

// URL processing
export * from './url-processing';

// Validation
export * from './validation';

// Selection
export * from './selection';

// Batch processing
export * from './batch-processing';

// Metadata
export * from './metadata';

// Optimization
export * from './optimization';

// Type detection
export * from './type-detection';

// ============================================================================
// Imports
// ============================================================================
import * as batchProcessing from './batch-processing';
import * as metadata from './metadata';
import * as optimization from './optimization';
import * as selection from './selection';
import * as typeDetection from './type-detection';
import * as types from './types';
import { cleanImageUrl } from './url-processing';
import * as urlProcessing from './url-processing';
import * as validation from './validation';

// ============================================================================
// Backward Compatibility Aliases
// ============================================================================
export const cleanWikiaImageUrl = cleanImageUrl;
export const cleanImageURL = cleanImageUrl;

// ============================================================================
// Default Export
// ============================================================================

export default {
  ...types,
  ...urlProcessing,
  ...validation,
  ...selection,
  ...batchProcessing,
  ...metadata,
  ...optimization,
  ...typeDetection,
};
