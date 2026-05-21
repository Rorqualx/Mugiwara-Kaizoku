/**
 * ComicVine Title Variant Generator
 *
 * Generates search query variants from primary title and alternative titles.
 * This improves search results for manga that may be indexed under different names
 * (e.g., "Attack on Titan" vs "Shingeki no Kyojin").
 */

import { stripTitlePatterns } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/matching/title-normalization';
import { logger } from '@/utils/logger';

import { getComicVineSearchConfig } from './search-config';

/**
 * Space-preserving normaliser used for variant uniqueness checks. Matches the
 * legacy title-similarity behaviour (stripTitlePatterns → lowercase → alnum+space).
 */
function normalizeTitle(title: string): string {
  return stripTitlePatterns(title)
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ============================================================================
// Types
// ============================================================================

/**
 * Alternative titles from metadata sources (AniList, MAL, etc.)
 */
export interface AlternativeTitles {
  english?: string;
  romaji?: string;
  native?: string;
  synonyms?: string[];
}

// ============================================================================
// Title Normalization for ComicVine
// ============================================================================

/**
 * Normalize a title for ComicVine search
 *
 * ComicVine-specific normalization that preserves important search terms
 * while removing noise that could hurt search accuracy.
 *
 * @param title - Title to normalize
 * @returns Normalized title for search
 */
export function normalizeForComicVineSearch(title: string): string {
  // Use the standard normalizeTitle as base
  let normalized = normalizeTitle(title);

  // Additional ComicVine-specific normalization:
  // Remove common suffixes that don't help search
  normalized = normalized
    // Remove "manga" suffix (e.g., "One Piece manga" -> "One Piece")
    .replace(/\s+manga$/i, '')
    // Remove "vol" and volume numbers (e.g., "Naruto vol 1" -> "Naruto")
    .replace(/\s+vol(?:ume)?\s*\d*$/i, '')
    // Remove "chapter" and numbers (e.g., "Bleach chapter 1" -> "Bleach")
    .replace(/\s+chapter\s*\d*$/i, '')
    // Remove issue numbers in brackets (e.g., "Batman [#1]" -> "Batman")
    .replace(/\s*\[#?\d+\]/g, '')
    // Normalize multiple spaces
    .replace(/\s+/g, ' ')
    .trim();

  return normalized;
}

/**
 * Strip parenthetical content for cleaner search
 *
 * Removes content in parentheses which often contains edition/publisher info
 * that can hurt search accuracy.
 *
 * @param title - Title to clean
 * @returns Title without parenthetical content
 */
function stripParentheticals(title: string): string {
  return title.replace(/\s*\([^)]*\)/g, '').trim();
}

/**
 * Extract the core title without subtitles
 *
 * For titles like "JoJo's Bizarre Adventure: Phantom Blood", extracts "JoJo's Bizarre Adventure".
 * Useful as a fallback search when the full title doesn't match.
 *
 * @param title - Title to process
 * @returns Core title or original if no subtitle found
 */
function extractCoreTitle(title: string): string | null {
  // Look for common subtitle separators
  const separators = [': ', ' - ', ' ~ '];

  for (const sep of separators) {
    const idx = title.indexOf(sep);
    if (idx > 3) { // Ensure we have a meaningful core title
      return title.substring(0, idx).trim();
    }
  }

  return null;
}

// ============================================================================
// Variant Generation
// ============================================================================

/**
 * Generate search query variants for ComicVine
 *
 * Creates multiple search queries from the primary title and alternative titles.
 * This improves the chance of finding the correct match, especially for:
 * - Manga with Japanese-only ComicVine entries
 * - Series with multiple editions
 * - Localized titles vs original titles
 *
 * @param primaryTitle - Main title to search for
 * @param alternativeTitles - Optional alternative titles from metadata
 * @param maxVariants - Maximum variants to generate (default from config)
 * @returns Array of unique search variants, ordered by priority
 */
export async function generateComicVineSearchVariants(
  primaryTitle: string,
  alternativeTitles?: AlternativeTitles,
  maxVariants?: number
): Promise<string[]> {
  const config = await getComicVineSearchConfig();
  const limit = maxVariants ?? config.maxQueriesPerSearch;

  const variants = new Set<string>();
  const normalizedVariants = new Set<string>();

  // Helper to add variant if unique
  const addVariant = (title: string | undefined | null): void => {
    if (!title || typeof title !== 'string') return;

    const trimmed = title.trim();
    if (trimmed.length < 2) return;

    // Check if normalized version is duplicate
    const normalized = normalizeForComicVineSearch(trimmed);
    if (normalized.length < 2 || normalizedVariants.has(normalized)) return;

    normalizedVariants.add(normalized);
    variants.add(trimmed);
  };

  // Priority 1: Primary title (always included)
  addVariant(primaryTitle);

  // Priority 2: Primary without parentheticals (often contains publisher/edition)
  const cleanPrimary = stripParentheticals(primaryTitle);
  if (cleanPrimary !== primaryTitle) {
    addVariant(cleanPrimary);
  }

  // Priority 3: English title (often the best match for US comics database)
  if (alternativeTitles?.english) {
    addVariant(alternativeTitles.english);
  }

  // Priority 4: Romaji title (for Japanese manga)
  if (alternativeTitles?.romaji) {
    addVariant(alternativeTitles.romaji);
  }

  // Priority 5: Synonyms (other known names)
  if (alternativeTitles?.synonyms) {
    for (const synonym of alternativeTitles.synonyms) {
      if (variants.size >= limit) break;
      addVariant(synonym);
    }
  }

  // Priority 6: Core title without subtitle (fallback)
  const coreTitle = extractCoreTitle(primaryTitle);
  if (coreTitle && variants.size < limit) {
    addVariant(coreTitle);
  }

  // Convert to array and limit
  const result = Array.from(variants).slice(0, limit);

  logger.debug('[ComicVine] Generated search variants', {
    primaryTitle,
    hasAlternatives: !!alternativeTitles,
    variantCount: result.length,
    variants: result,
  });

  return result;
}

/**
 * Generate search variants synchronously using default config
 *
 * Useful when async is not possible and a sensible default is acceptable.
 *
 * @param primaryTitle - Main title to search for
 * @param alternativeTitles - Optional alternative titles from metadata
 * @param maxVariants - Maximum variants to generate (default: 2)
 * @returns Array of unique search variants
 */
export function generateComicVineSearchVariantsSync(
  primaryTitle: string,
  alternativeTitles?: AlternativeTitles,
  maxVariants: number = 2
): string[] {
  const variants = new Set<string>();
  const normalizedVariants = new Set<string>();

  const addVariant = (title: string | undefined | null): void => {
    if (!title || typeof title !== 'string') return;

    const trimmed = title.trim();
    if (trimmed.length < 2) return;

    const normalized = normalizeForComicVineSearch(trimmed);
    if (normalized.length < 2 || normalizedVariants.has(normalized)) return;

    normalizedVariants.add(normalized);
    variants.add(trimmed);
  };

  addVariant(primaryTitle);
  addVariant(stripParentheticals(primaryTitle));
  addVariant(alternativeTitles?.english);
  addVariant(alternativeTitles?.romaji);

  if (alternativeTitles?.synonyms) {
    for (const synonym of alternativeTitles.synonyms) {
      if (variants.size >= maxVariants) break;
      addVariant(synonym);
    }
  }

  const coreTitle = extractCoreTitle(primaryTitle);
  if (coreTitle && variants.size < maxVariants) {
    addVariant(coreTitle);
  }

  return Array.from(variants).slice(0, maxVariants);
}
