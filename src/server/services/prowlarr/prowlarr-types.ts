/**
 * Prowlarr Type Definitions
 *
 * Shared type definitions and interfaces for Prowlarr integration.
 * Foundation module - no dependencies.
 *
 * Extracted from: mangaSearch.ts (lines 11-25, 132-139)
 */

/**
 * Raw API response from Prowlarr search endpoint
 *
 * Represents a single search result returned by Prowlarr's API.
 * Contains torrent/usenet metadata including download URLs, seeders, and categories.
 */
export interface ProwlarrApiSearchResult {
  /** Unique identifier for this result (used for deduplication) */
  guid: string;

  /** Release title (contains manga name, volume/chapter info, quality, etc.) */
  title: string;

  /** Name of the indexer that provided this result */
  indexer: string;

  /** Numeric ID of the indexer (optional) */
  indexerId?: number;

  /** Protocol type: 'torrent' or 'usenet' */
  protocol?: string;

  /** File size in bytes */
  size: number;

  /** Number of seeders (torrent only) */
  seeders?: number;

  /** Number of leechers (torrent only) */
  leechers?: number;

  /** URL to download the release */
  downloadUrl: string;

  /** Magnet link (torrent only) */
  magnetUrl?: string;

  /** URL with more information about the release */
  infoUrl?: string;

  /** ISO 8601 timestamp when release was published */
  publishDate?: string;

  /** Prowlarr category IDs (e.g., 7030 for comics, 7000 for books) */
  categories?: number[];
}

/**
 * Search options for Prowlarr manga search
 *
 * Configuration parameters for filtering and limiting search results.
 */
export interface SearchOptions {
  /** Prowlarr category IDs to search (e.g., 7030 for comics, 7000 for books) */
  categories?: number[];

  /** Specific indexer names to search (if not specified, searches all enabled indexers) */
  indexers?: string[];

  /** Maximum number of results to return */
  limit?: number;

  /** Only include results from the last X days */
  maxage?: number;

  /** Minimum file size in bytes */
  minsize?: number;

  /** Maximum file size in bytes */
  maxsize?: number;
}

/**
 * API search result with calculated relevance score
 *
 * Extends ProwlarrApiSearchResult with a relevance score used for sorting.
 * Score is calculated based on:
 * - Title match quality (exact match = +100)
 * - Manga/comic keywords (+15-20)
 * - Volume/chapter indicators (+10)
 * - Complete collections (+30)
 * - Seeders count (+10-20)
 * - Language/quality indicators (+5-25)
 */
export type RelevanceScoredResult = ProwlarrApiSearchResult & {
  /** Calculated relevance score (higher = more relevant) */
  relevanceScore: number;
};
