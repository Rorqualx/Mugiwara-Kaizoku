/**
 * Manga Detail Page - Foundation Utilities
 *
 * Shared type definitions, utility functions, and constants
 * used across manga detail page modules.
 *
 * Extracted from: src/pages/manga/[id].tsx (lines 58-88)
 */

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * External link structure for manga metadata
 * TODO: Move to @/types/domain/manga-types when finalized
 */
export type ExternalLink = {
  url: string;
  site?: string;
};

/**
 * Monitoring configuration structure
 * TODO: Move to @/types/domain/manga-types when finalized
 */
export type MonitoringConfig = unknown;

/**
 * Provider descriptions structure
 * TODO: Move to @/types/adapters when finalized
 */
export type ProviderDescriptions = unknown;

/**
 * Provider data structure
 * TODO: Move to @/types/adapters when finalized
 */
export type ProviderData = unknown;

/**
 * Import profile structure
 * TODO: Move to @/types/domain when finalized
 */
export type ImportProfile = unknown;

/**
 * Provider metadata container
 * TODO: Move to @/types/adapters when finalized
 */
export type ProviderMetadataContainer = unknown;

/**
 * Metadata record structure
 * TODO: Move to @/types/domain when finalized
 */
export type MetadataRecord = unknown;

// ============================================================================
// Utility Functions
// ============================================================================

// Re-export utility functions from mangaDetailUtils for convenience
export {
  formatFileSize,
  formatDate,
  stripHtmlTags,
  getProviderUrl,
  countVolumes
} from '@/components/manga/mangaDetailUtils';

/**
 * Parse HTML content to plain text
 * Currently an alias of stripHtmlTags
 * TODO: Implement proper HTML parsing if needed
 */
export { stripHtmlTags as parseHtmlContent } from '@/components/manga/mangaDetailUtils';

/**
 * Check if manga has metadata
 * TODO: Implement proper metadata validation
 * @param manga - Manga object to check
 * @returns True if manga has metadata
 */
export function hasMetadata(manga: unknown): boolean {
  return Boolean(manga);
}

/**
 * Get language name from language code
 * TODO: Implement proper language code to name mapping
 * @param code - Language code (e.g., 'en', 'ja')
 * @returns Language name
 */
export function getLanguageName(code: string): string {
  return code; // Temporary: return code as-is
}
