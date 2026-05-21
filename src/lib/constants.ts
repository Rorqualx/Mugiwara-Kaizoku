/**
 * Constants used throughout the application
 */


// Common release groups for auto-download filtering
export const COMMON_RELEASE_GROUPS = [
  'HorribleSubs',
  'SubsPlease', 
  'Erai-raws',
  'EMBER',
  'ASW',
  'GJM',
  'Commie',
  'FFF',
  'Vivid',
  'Asenshi',
  'BlurayDesuYo',
  'Coalgirls',
  'Doki',
  'UTW'
];

// Download-related constants
export const DOWNLOAD_CONSTANTS = {
  DEFAULT_MAX_SIZE_MB: 100,
  DEFAULT_CHECK_INTERVAL: 3600, // 1 hour in seconds
  DEFAULT_FORMAT: 'cbz' as const,
  DEFAULT_QUALITY: 'medium' as const
};
