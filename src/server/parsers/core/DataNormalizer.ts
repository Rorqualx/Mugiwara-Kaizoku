/**
 * Data Normalization Engine
 *
 * Re-exports from the modularized data-normalizer directory.
 * This file maintains backward compatibility with existing imports.
 *
 * For implementation details, see:
 * - data-normalizer/types.ts      - Type definitions
 * - data-normalizer/utils.ts      - Helper utilities
 * - data-normalizer/metadata.ts   - Metadata normalization
 * - data-normalizer/volumes.ts    - Volume processing
 * - data-normalizer/chapters.ts   - Chapter processing
 * - data-normalizer/images-links.ts - Image/link processing
 * - data-normalizer/post-process.ts - Post-processing & validation
 * - data-normalizer/index.ts      - Main DataNormalizer class
 *
 * Original: 865 lines → Refactored: 8 modules (see data-normalizer/)
 */

// Re-export everything from the modularized structure
export * from './data-normalizer';
