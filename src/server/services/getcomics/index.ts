/**
 * GetComics Service Exports
 *
 * @module server/services/getcomics
 */

export { GetComicsService, getGetComicsService, resetGetComicsService } from './getcomicsService';
export type {
  FileHostType,
  GetComicsConfig,
  GetComicsDetailPage,
  GetComicsDownloadLink,
  GetComicsSearchResult,
} from './types';
export {
  DEFAULT_GETCOMICS_CONFIG,
  FILE_HOST_PATTERNS,
  GETCOMICS_SELECTORS,
} from './types';
