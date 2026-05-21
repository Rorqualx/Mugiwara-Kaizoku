/**
 * Event Configuration Types
 *
 * Shared type definitions for event configuration hooks
 */

export enum EventLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

export enum EventSource {
  SYSTEM = 'system',
  LIBRARY = 'library',
  MANGA = 'manga',
  DOWNLOAD = 'download',
  ANILIST = 'anilist',
  COMICVINE = 'comicvine',
  FANDOM = 'fandom',
  SUWAYOMI = 'suwayomi',
  PROWLARR = 'prowlarr',
  USER = 'user',
  TASK = 'task',
  BACKUP = 'backup',
  DATABASE = 'database',
  METADATA = 'metadata',
}

/**
 * Interface for event configuration
 */
export interface EventConfig {
  retention: {
    days: number;
  };
  log: {
    minLevel: EventLevel;
  };
  display: {
    maxEvents: number;
  };
  notification: {
    onError: boolean;
    onWarning: boolean;
  };
  visibility: {
    sources: EventSource[];
    levels: EventLevel[];
  };
}

/**
 * Interface for visibility settings updates
 */
export interface VisibilitySettings {
  sources?: EventSource[];
  levels?: EventLevel[];
}

/**
 * Default event configuration values
 */
export const defaultEventConfig: EventConfig = {
  retention: {
    days: 30
  },
  log: {
    minLevel: EventLevel.INFO
  },
  display: {
    maxEvents: 100
  },
  notification: {
    onError: true,
    onWarning: false
  },
  visibility: {
    sources: Object.values(EventSource),
    levels: Object.values(EventLevel)
  }
};
