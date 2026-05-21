/**
 * Migration Types and Constants
 *
 * Foundation types and constants for the parser migration system.
 * Defines configuration options, result structures, and parser mappings.
 *
 * Extracted from: MigrationScript.ts (lines 1-62)
 *
 * @module parsers/migration/types
 */

// ============================================================================
// Migration Configuration
// ============================================================================

/**
 * Configuration options for parser migration
 */
export interface MigrationConfig {
  /** If true, simulate migration without making changes */
  dryRun?: boolean;

  /** Enable detailed logging output */
  verbose?: boolean;

  /** Directory path for backup files */
  backupDir?: string;

  /** Path to migration log file */
  migrationLog?: string;

  /** If true, keep old code after migration */
  preserveOldCode?: boolean;

  /** If true, run in test mode with additional validation */
  testMode?: boolean;
}

/**
 * Result of migration execution
 */
export interface MigrationResult {
  /** Overall success status */
  success: boolean;

  /** Total number of files processed */
  filesProcessed: number;

  /** Number of files successfully migrated */
  filesMigrated: number;

  /** Number of files skipped during migration */
  filesSkipped: number;

  /** List of errors encountered during migration */
  errors: Array<{ file: string; error: string }>;

  /** Location of backup files (if created) */
  backupLocation?: string;

  /** Post-migration recommendations */
  recommendations: string[];
}

// ============================================================================
// Parser Migration Mappings
// ============================================================================

/**
 * Maps old parser files and methods to new unified parser equivalents
 *
 * Structure:
 * - File mappings: Map old parser filenames to new adapter classes
 * - Method mappings: Map old method names to new unified method names
 */
export const PARSER_MAPPINGS = {
  // Map old parser files to new unified parser methods
  'fandomParser.ts': 'FandomAdapter',
  'wikipediaParser.ts': 'WikipediaAdapter',
  'mangadexParser.ts': 'MangaDexAdapter',
  'anilistParser.ts': 'AniListAdapter',
  'comicvineParser.ts': 'ComicVineAdapter',

  // Map old methods to new ones
  'parseFandomWiki': 'parseUnified',
  'parseWikipedia': 'parseUnified',
  'extractMangaData': 'parseUnified',
  'getMetadata': 'extractMetadata',
  'parseVolumes': 'extractVolumes',
  'parseChapters': 'extractChapters',
  'extractCover': 'extractCoverImage',
  'parseInfobox': 'extractFromInfobox',
  'extractTables': 'extractTables',
  'getImages': 'extractImages',
} as const;
