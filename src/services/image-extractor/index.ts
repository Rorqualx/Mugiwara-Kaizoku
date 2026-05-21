/**
 * Image Extractor Service - Main Entry Point
 *
 * Provides comprehensive image extraction from provider metadata with:
 * - Automatic deduplication
 * - Multiple provider support (Wizard, Fandom, ComicVine, AniList, Wikipedia)
 * - Type-safe extraction with full TypeScript support
 * - Categorized output for UI display
 *
 * ## Refactoring Summary
 *
 * **Original**: 1 file, 680 lines, complexity 38
 * **Refactored**: 10 modules, well-organized architecture
 *
 * ### Module Structure
 *
 * ```
 * src/services/image-extractor/
 * ├── index.ts              ← Main entry point (this file)
 * ├── types.ts              ← Type definitions and guards (229 lines)
 * ├── core.ts               ← ImageExtractor class (216 lines)
 * ├── orchestrator.ts       ← extractAllImages function (288 lines)
 * └── extractors/
 *     ├── wizard.ts         ← Wizard extraction (87 lines)
 *     ├── fandom.ts         ← Fandom extraction (126 lines)
 *     ├── comicvine.ts      ← ComicVine extraction (63 lines)
 *     ├── anilist.ts        ← AniList extraction (78 lines)
 *     ├── wikipedia.ts      ← Wikipedia extraction (52 lines)
 *     └── selected.ts       ← Selected provider extraction (65 lines)
 * ```
 *
 * ### Key Improvements
 *
 * 1. **Error Fixes**:
 *    - ✅ Fixed unsafe array assignments (lines 146, 150)
 *    - ✅ Fixed unsafe JSON parsing (line 489)
 *    - ✅ Fixed null reference error (line 586)
 *
 * 2. **Complexity Reduction**:
 *    - ✅ Main function: 62 statements → 9 statements (86% reduction)
 *    - ✅ Main function: complexity 38 → 3 (92% reduction)
 *
 * 3. **Code Quality**:
 *    - ✅ All modules under 300 lines
 *    - ✅ Zero `any` types across all modules
 *    - ✅ Explicit return types on all functions
 *    - ✅ Comprehensive type guards for safety
 *
 * 4. **Architecture**:
 *    - ✅ Single Responsibility: Each module has one clear purpose
 *    - ✅ Dependency Direction: Foundation → Specific (no circular deps)
 *    - ✅ Testability: Each extractor can be tested independently
 *
 * ## Usage
 *
 * ### Basic Usage
 *
 * ```typescript
 * import { extractAllImages } from '@/services/image-extractor';
 *
 * const { coverOptions, bannerOptions, categories } = extractAllImages(
 *   providerMetadata,
 *   standardMetadata
 * );
 * ```
 *
 * ### Advanced Usage with ImageExtractor Class
 *
 * ```typescript
 * import { ImageExtractor } from '@/services/image-extractor';
 *
 * const extractor = new ImageExtractor();
 *
 * // Extract from specific providers
 * if (metadata.fandom) {
 *   extractor.extractFandomImages(metadata.fandom);
 * }
 *
 * // Get results
 * const coverImages = extractor.getImagesByType('cover');
 * const categories = extractor.getCategorizedImages();
 * ```
 *
 * ### Using Individual Extractors
 *
 * ```typescript
 * import { extractFandomImages } from '@/services/image-extractor';
 *
 * const images: ImageOption[] = [];
 * const addImage = (img: ImageOption) => images.push(img);
 *
 * extractFandomImages(fandomData, addImage);
 * ```
 *
 * @module image-extractor
 * @since 2025-11-20
 */

// ============================================================================
// Main Exports
// ============================================================================

export { ImageExtractor } from './core';
export { extractAllImages } from './orchestrator';

// ============================================================================
// Type Exports
// ============================================================================

export type {
  ImageOption,
  ImageCategory,
  ProviderMetadata,
  WizardSelectedImages,
  FandomMetadata,
  FandomVolume,
  FandomChapter,
  ComicVineMetadata,
  ComicVineIssue,
  AniListMetadata,
  WikipediaMetadata,
  SelectedProviderMetadata,
} from './types';

// ============================================================================
// Provider Extractor Exports (Advanced Usage)
// ============================================================================

export { extractWizardImages } from './extractors/wizard';
export { extractFandomImages, extractFandomGallery } from './extractors/fandom';
export { extractComicVineImages } from './extractors/comicvine';
export { extractAniListImages } from './extractors/anilist';
export { extractWikipediaImages } from './extractors/wikipedia';
export { extractSelectedProviderImages } from './extractors/selected';

// ============================================================================
// Type Guard Exports (Advanced Usage)
// ============================================================================

export {
  isGalleryArray,
  isStringArray,
  isProviderMetadata,
  isImageObject,
  parseProviderMetadata,
  getProviderNameSafe
} from './types';
