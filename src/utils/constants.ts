/**
 * Common constants used throughout the application
 * 
 * @module constants
 */


/**
 * Default download formats
 */
export const DOWNLOAD_FORMATS = {
  CBZ: 'cbz',
  PDF: 'pdf',
  EPUB: 'epub',
  RAW: 'raw'
} as const;

/**
 * Quality levels for auto-download
 */
export const QUALITY_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  BEST: 'best'
} as const;

/**
 * Common check intervals in seconds
 */
export const CHECK_INTERVALS = {
  MINUTES_15: 900,
  MINUTES_30: 1800,
  HOUR_1: 3600,
  HOURS_2: 7200,
  HOURS_6: 21600,
  HOURS_12: 43200,
  DAY_1: 86400,
  WEEK_1: 604800
} as const;

/**
 * Prowlarr manga categories
 */
export const PROWLARR_MANGA_CATEGORIES = [7000, 7010, 7020, 7030, 7040];

/**
 * Default auto-download configuration
 */
export const DEFAULT_AUTO_DOWNLOAD_CONFIG = {
  enabled: false,
  minQuality: QUALITY_LEVELS.MEDIUM,
  maxSize: 104857600, // 100MB in bytes
  preferredGroups: [],
  excludeGroups: [],
  language: 'en',
  format: DOWNLOAD_FORMATS.CBZ,
  checkInterval: CHECK_INTERVALS.HOUR_1
} as const;
