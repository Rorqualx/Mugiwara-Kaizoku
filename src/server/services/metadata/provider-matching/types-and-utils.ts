/**
 * Provider Matching - Types and Utilities
 *
 * Foundation module providing shared types, interfaces, and utility functions
 * for cross-provider manga matching and metadata operations.
 *
 * This module has zero dependencies on service code and can be used standalone.
 *
 * Extracted from: providerMatchingService.ts
 * Date: 2025-11-21
 *
 * @module provider-matching/types-and-utils
 */

import { DEFAULT_FIELD_PRIORITIES } from '@/types/search-types/configuration.types';
import type { MangaMetadata } from '@/types/search.types';

// ============================================================================
// Type Definitions & Interfaces
// ============================================================================

/**
 * Match result with provider information and confidence score
 */
export interface ProviderMatchResult {
    /** Provider name */
    provider: string;
    /** Provider-specific ID */
    providerId: string;
    /** Title from provider */
    title: string;
    /** Confidence score (0.0 to 1.0) */
    confidence: number;
    /** Additional metadata if available */
    metadata?: MangaMetadata;
}

/**
 * Cross-provider match result
 */
export interface CrossProviderMatchResult {
    /** Original search query */
    query: string;
    /** Matches found across providers */
    matches: ProviderMatchResult[];
    /** Best match recommendation */
    bestMatch?: ProviderMatchResult;
    /** Merged metadata from all matches */
    mergedMetadata?: MangaMetadata;
}

/**
 * Configuration for the provider matching service
 */
export interface ProviderMatchingServiceConfig {
    /** Minimum similarity score threshold (0.0 to 1.0) */
    minScore?: number;
    /** Weight factors for different matching strategies */
    weights?: {
        exact?: number;
        partial?: number;
        alternative?: number;
        pattern?: number;
    };
    /** Providers to exclude from matching */
    excludeProviders?: string[];
    /** Whether to fetch metadata for matches */
    fetchMetadata?: boolean;
    /** Whether to merge metadata from multiple providers */
    mergeMetadata?: boolean;
}

/**
 * Metadata with provider information for merging operations
 */
export interface MetadataWithProvider {
    provider: string;
    metadata: MangaMetadata;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Provider priority order for metadata merging
 * Derived from DEFAULT_FIELD_PRIORITIES using 'title' field as base
 * Higher priority providers appear first
 */
export const PROVIDER_PRIORITY: readonly string[] = (
  DEFAULT_FIELD_PRIORITIES['title'] ?? ['anilist', 'mangadex', 'comicvine', 'fandom', 'wikipedia']
) as readonly string[];

/**
 * Default minimum similarity score threshold
 */
export const DEFAULT_MIN_SCORE = 0.1;

/**
 * Default weight factors for matching strategies
 */
export const DEFAULT_WEIGHTS = {
    exact: 1,
    partial: 0.7,
    alternative: 0.5,
    pattern: 0.3,
} as const;

// ============================================================================
// String Normalization & Comparison Utilities
// ============================================================================

/**
 * Normalize string for comparison
 *
 * Converts string to lowercase, normalizes Unicode, removes special characters,
 * and collapses whitespace for consistent comparison.
 *
 * @param str - String to normalize
 * @returns Normalized string suitable for comparison
 *
 * @example
 * ```typescript
 * normalizeForComparison("One-Piece: Chapter 1") // "one piece chapter 1"
 * ```
 */
export function normalizeForComparison(str: string): string {
    return str
        .toLowerCase()
        .normalize('NFKC')
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Calculate Levenshtein distance between two strings
 *
 * Uses dynamic programming to compute the minimum number of single-character
 * edits (insertions, deletions, or substitutions) required to change one
 * string into another.
 *
 * @param str1 - First string
 * @param str2 - Second string
 * @returns Levenshtein distance (0 means identical strings)
 *
 * @example
 * ```typescript
 * levenshteinDistance("kitten", "sitting") // 3
 * levenshteinDistance("hello", "hello") // 0
 * ```
 */
export function levenshteinDistance(str1: string, str2: string): number {
    const m = str1.length;
    const n = str2.length;

    if (m === 0) return n;
    if (n === 0) return m;

    const row = new Array<number>(n + 1);
    for (let j = 0; j <= n; j++) {
        row[j] = j;
    }

    let prevRow = new Array<number>(n + 1);

    for (let i = 1; i <= m; i++) {
        prevRow = [...row];
        row[0] = i;

        for (let j = 1; j <= n; j++) {
            const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
            row[j] = Math.min(
                (prevRow[j] ?? 0) + 1,      // deletion
                (row[j - 1] ?? 0) + 1,      // insertion
                (prevRow[j - 1] ?? 0) + cost // substitution
            );
        }
    }

    return row[n] ?? 0;
}
