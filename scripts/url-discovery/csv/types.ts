/**
 * CSV Types for URL Discovery Tool
 *
 * Defines the structure of the authoritative CSV file used for
 * manga title URL discovery and validation.
 *
 * @module url-discovery/csv/types
 */

/**
 * Represents a row in the ML training CSV file.
 * All URL/ID fields can be:
 * - A valid URL/ID string
 * - Empty string (not searched yet)
 * - "DOES_NOT_EXIST" (searched, not found)
 */
export interface CsvRow {
  /** The manga title */
  Title: string;
  /** AniList ID for the manga */
  AniListID: string;
  /** Wikipedia URL for chapters/volumes page */
  WikipediaURL: string;
  /** Fandom URL for chapters/volumes page */
  FandomURL: string;
  /** ComicVine volume ID */
  ComicVineID: string;
}

/**
 * Sentinel value indicating a source was searched but not found.
 */
export const DOES_NOT_EXIST = 'DOES_NOT_EXIST';

/**
 * Check if a value indicates the source was searched but not found.
 */
export function isDoesNotExist(value: string): boolean {
  return value === DOES_NOT_EXIST;
}

/**
 * Check if a value indicates the source has not been searched yet.
 */
export function isNotSearched(value: string): boolean {
  return value === '';
}

/**
 * Check if a value contains a valid URL/ID.
 */
export function hasValidValue(value: string): boolean {
  return value !== '' && value !== DOES_NOT_EXIST;
}

/**
 * Discovery result for a single title.
 */
export interface DiscoveryResult {
  /** The manga title being searched */
  title: string;
  /** AniList ID (from CSV) */
  anilistId: string;
  /** Wikipedia discovery result */
  wikipedia: {
    url: string | null;
    error?: string;
  };
  /** Fandom discovery result */
  fandom: {
    url: string | null;
    domain?: string;
    error?: string;
  };
  /** ComicVine discovery result */
  comicvine: {
    id: string | null;
    url?: string;
    error?: string;
  };
  /** Timing information in milliseconds */
  timing: {
    wikipedia: number;
    fandom: number;
    comicvine: number;
    total: number;
  };
}

/**
 * Options for the discovery process.
 */
export interface DiscoveryOptions {
  /** Path to input CSV file */
  inputCsv: string;
  /** Path to output CSV file */
  outputCsv: string;
  /** Number of titles to process per batch */
  batchSize: number;
  /** Which sources to search */
  sources: Array<'wikipedia' | 'fandom' | 'comicvine'>;
  /** Only process rows with empty values */
  onlyEmpty: boolean;
  /** Don't write output, just log results */
  dryRun: boolean;
  /** Resume from specific row (0-indexed) */
  startRow?: number;
  /** Stop at specific row (0-indexed) */
  endRow?: number;
  /** Output detailed logs */
  verbose: boolean;
}

/**
 * Default discovery options.
 */
export const DEFAULT_DISCOVERY_OPTIONS: DiscoveryOptions = {
  inputCsv: 'ml-training-titles.csv',
  outputCsv: 'ml-training-titles-enriched.csv',
  batchSize: 5,
  sources: ['wikipedia', 'fandom', 'comicvine'],
  onlyEmpty: false,
  dryRun: false,
  verbose: false,
};

/**
 * Statistics collected during discovery.
 */
export interface DiscoveryStats {
  /** Total rows in CSV */
  totalRows: number;
  /** Rows processed */
  processed: number;
  /** Rows skipped (already have values) */
  skipped: number;
  /** Per-source statistics */
  wikipedia: SourceStats;
  fandom: SourceStats;
  comicvine: SourceStats;
  /** Errors encountered */
  errors: Array<{
    title: string;
    source: string;
    error: string;
  }>;
  /** Total duration in milliseconds */
  durationMs: number;
}

/**
 * Statistics for a single source.
 */
export interface SourceStats {
  /** Number of URLs/IDs found */
  found: number;
  /** Number of searches that returned no result */
  notFound: number;
  /** Number of errors */
  errors: number;
  /** Average time per search in milliseconds */
  avgTimeMs: number;
  /** Total searches performed */
  totalSearches: number;
}

/**
 * Create empty source stats.
 */
export function createEmptySourceStats(): SourceStats {
  return {
    found: 0,
    notFound: 0,
    errors: 0,
    avgTimeMs: 0,
    totalSearches: 0,
  };
}

/**
 * Create empty discovery stats.
 */
export function createEmptyDiscoveryStats(): DiscoveryStats {
  return {
    totalRows: 0,
    processed: 0,
    skipped: 0,
    wikipedia: createEmptySourceStats(),
    fandom: createEmptySourceStats(),
    comicvine: createEmptySourceStats(),
    errors: [],
    durationMs: 0,
  };
}
