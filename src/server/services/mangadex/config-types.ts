/**
 * MangaDex configuration types.
 *
 * Split from `./types.ts` to keep that (already-large) API-types module
 * under the 500-line ceiling. The configuration model has its own concerns
 * (DB-backed `mangadex.*` keys, role-specific slices) that fit cleanly here.
 */

import type { ContentRating } from './types';

/** Rate limit shared by both MangaDex roles (single API client). */
export interface MangaDexRateLimit {
  maxRequests: number;
  perMilliseconds: number;
}

/**
 * Metadata-side MangaDex config (consumed by metadata enrichment).
 * `enabled` here is the metadata-provider toggle, owned by `mangadex.enabled`.
 * `preferredLanguage` is shared with the download role.
 */
export interface MangaDexMetadataConfig {
  enabled: boolean;
  preferredLanguage: string;
  includeAdult: boolean;
  defaultContentRating: ContentRating[];
  rateLimit: MangaDexRateLimit;
}

/**
 * Download-side MangaDex config (consumed by chapter downloader).
 * `enabled` here is the indexer/download toggle, owned by `mangadex.download.enabled`.
 * `preferredLanguage` is shared with the metadata role.
 */
export interface MangaDexDownloadConfig {
  enabled: boolean;
  preferredLanguage: string;
  /**
   * When true, a chapter with no `preferredLanguage` translation on MangaDex
   * may be downloaded in *any* available language. Defaults to false: the
   * language preference is a hard filter, and chapters MangaDex only carries
   * in other languages are left for Prowlarr/Suwayomi to satisfy.
   *
   * Historically this was implicitly `true` and unconfigurable, which is how
   * es-la/ca/vi chapters landed in English-only libraries.
   */
  allowLanguageFallback: boolean;
  dataSaverMode: boolean;
  rateLimit: MangaDexRateLimit;
}

/**
 * Full MangaDex configuration (union of both roles + shared rate limit).
 * Most callers should prefer the role-specific configs above; this exists
 * for the client factory which needs the shared `rateLimit` only.
 */
export interface MangaDexConfig {
  metadataEnabled: boolean;
  downloadEnabled: boolean;
  preferredLanguage: string;
  allowLanguageFallback: boolean;
  includeAdult: boolean;
  defaultContentRating: ContentRating[];
  dataSaverMode: boolean;
  rateLimit: MangaDexRateLimit;
}

const DEFAULT_RATE_LIMIT: MangaDexRateLimit = {
  maxRequests: 5,
  perMilliseconds: 1000,
};

export const DEFAULT_MANGADEX_METADATA_CONFIG: MangaDexMetadataConfig = {
  enabled: true,
  preferredLanguage: 'en',
  includeAdult: false,
  defaultContentRating: ['safe', 'suggestive'],
  rateLimit: DEFAULT_RATE_LIMIT,
};

export const DEFAULT_MANGADEX_DOWNLOAD_CONFIG: MangaDexDownloadConfig = {
  enabled: true,
  preferredLanguage: 'en',
  allowLanguageFallback: false,
  dataSaverMode: false,
  rateLimit: DEFAULT_RATE_LIMIT,
};

export const DEFAULT_MANGADEX_CONFIG: MangaDexConfig = {
  metadataEnabled: true,
  downloadEnabled: true,
  preferredLanguage: 'en',
  allowLanguageFallback: false,
  includeAdult: false,
  defaultContentRating: ['safe', 'suggestive'],
  dataSaverMode: false,
  rateLimit: DEFAULT_RATE_LIMIT,
};
