/**
 * Suwayomi Adapter Types
 */

import type { BaseIntegrationConfig } from '../config.types';

// Define BaseAdapterConfig interface locally for this module
interface BaseAdapterConfig extends BaseIntegrationConfig {
  baseUrl?: string;
  apiKey?: string;
  retryAttempts?: number;
  cacheEnabled?: boolean;
  cacheTTL?: number;
  rateLimit?: number; // requests per second
}

/**
 * Suwayomi configuration
 */
export interface SuwayomiConfig extends BaseAdapterConfig {
  id: string;
  name: string;
  enabled: boolean;
  url: string;
  username?: string;
  password?: string;
  apiPath?: string;
  downloadPath?: string;
  autoDownload?: boolean;
  apiKeySources?: string[];
}

/**
 * Suwayomi manga
 */
export interface SuwayomiManga {
  id: number;
  sourceId: string;
  url: string;
  title: string;
  artist?: string;
  author?: string;
  description?: string;
  genre?: string[];
  status?: string;
  thumbnail?: string;
  inLibrary?: boolean;
  initialized?: boolean;
}

/**
 * Suwayomi chapter
 */
export interface SuwayomiChapter {
  id: number;
  mangaId: number;
  url: string;
  name: string;
  number: number;
  scanlator?: string;
  uploadDate?: number;
  read?: boolean;
  downloaded?: boolean;
  bookmarked?: boolean;
  lastPageRead?: number;
  index?: number;
}

/**
 * Suwayomi source
 */
export interface SuwayomiSource {
  id: string;
  name: string;
  lang: string;
  iconUrl?: string;
  supportsLatest?: boolean;
  isConfigurable?: boolean;
  isNsfw?: boolean;
  displayName?: string;
}

/**
 * Suwayomi category
 */
export interface SuwayomiCategory {
  id: number;
  name: string;
  order: number;
  default?: boolean;
}

/**
 * Suwayomi download
 */
export interface SuwayomiDownload {
  chapterId: number;
  mangaId: number;
  state: 'PENDING' | 'DOWNLOADING' | 'FINISHED' | 'error';
  progress: number;
  tries: number;
}

/**
 * Suwayomi extension
 */
export interface SuwayomiExtension {
  apkName: string;
  iconUrl?: string;
  name: string;
  pkgName: string;
  versionName: string;
  versionCode: number;
  lang: string;
  isNsfw?: boolean;
  hasUpdate?: boolean;
  isInstalled?: boolean;
  isObsolete?: boolean;
}
