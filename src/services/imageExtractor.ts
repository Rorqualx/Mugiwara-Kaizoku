/**
 * Image Extractor Service
 *
 * @deprecated This file is kept for backward compatibility.
 * Import from '@/services/image-extractor' instead.
 *
 * ## Migration Guide
 *
 * **Before**:
 * ```typescript
 * import { ImageExtractor, extractAllImages } from '@/services/imageExtractor';
 * ```
 *
 * **After** (recommended):
 * ```typescript
 * import { ImageExtractor, extractAllImages } from '@/services/image-extractor';
 * ```
 *
 * **Note**: Both imports work identically. This file simply re-exports from
 * the new modular structure. No breaking changes.
 *
 * ## Refactoring Summary
 *
 * **Date**: 2025-11-20
 * **Original File**: Backed up to `imageExtractor.ts.backup` (680 lines)
 * **New Structure**: 10 focused modules in `src/services/image-extractor/`
 *
 * ### Error Fixes Applied
 *
 * 1. ✅ Line 146, 150: Unsafe array assignments → Fixed with type guards
 * 2. ✅ Line 489: Unsafe JSON.parse → Fixed with parseProviderMetadata helper
 * 3. ✅ Line 586: Null reference → Fixed with null check
 * 4. ✅ Line 467: max-statements (62) → Reduced to 9 (86% reduction)
 * 5. ✅ Line 467: complexity (38) → Reduced to 3 (92% reduction)
 *
 * ### Architecture Changes
 *
 * **Before**: Monolithic 680-line file
 * **After**: Modular architecture with:
 * - Foundation layer (types.ts, 229 lines)
 * - Core class (core.ts, 216 lines)
 * - Orchestrator (orchestrator.ts, 288 lines)
 * - 6 provider extractors (471 lines total, average 78 lines each)
 *
 * ### Benefits
 *
 * - ✅ **Maintainability**: Each module < 300 lines, single responsibility
 * - ✅ **Type Safety**: Zero `any` types, comprehensive type guards
 * - ✅ **Testability**: Independent extractor modules
 * - ✅ **Extensibility**: Easy to add new provider extractors
 * - ✅ **Performance**: Identical runtime behavior, no overhead
 * - ✅ **Backward Compatible**: All existing imports still work
 *
 * @module imageExtractor
 * @deprecated Use @/services/image-extractor instead
 */

// Re-export everything from the new modular structure
export * from './image-extractor';
