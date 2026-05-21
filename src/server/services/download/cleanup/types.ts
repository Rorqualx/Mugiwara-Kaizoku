/**
 * Types for post-import download client cleanup
 *
 * @module server/services/download/cleanup/types
 */

/**
 * Configuration for post-import cleanup behavior
 */
export interface DownloadCleanupConfig {
  /** Master switch — when false, cleanup is skipped entirely */
  enabled: boolean;
  /** Whether to delete files on disk when removing the download from the client */
  deleteFiles: boolean;
  /**
   * When true AND protocol === 'torrent', cleanup is skipped entirely so the
   * torrent keeps seeding for tracker ratio. NZB downloads ignore this flag.
   */
  keepTorrentsForSeeding: boolean;
}

/**
 * Default configuration values for post-import cleanup
 */
export const DEFAULT_CLEANUP_CONFIG: DownloadCleanupConfig = {
  enabled: true,
  deleteFiles: true,
  keepTorrentsForSeeding: false,
};

/**
 * Keys used for cleanup configuration in the Config table
 */
export const CLEANUP_CONFIG_KEYS = {
  ENABLED: 'download.cleanup.enabled',
  DELETE_FILES: 'download.cleanup.deleteFiles',
  KEEP_TORRENTS_FOR_SEEDING: 'download.cleanup.keepTorrentsForSeeding',
} as const;
