/**
 * Kapowarr Downloaders Index
 *
 * @module server/services/native-download/downloaders
 */

export {
  createCBZ,
  generatePageName,
  getImageExtension,
  type CBZBundleOptions,
  type ComicInfoMetadata,
  type PageEntry
} from './cbz-bundler';

export {
  mangadexDownloader,
  downloadMangaDexChapter,
  MangaDexDownloader,
  type DownloadProgress,
  type DownloadQuality,
  type MangaDexDownloadOptions,
  type MangaDexDownloadResult
} from './mangadex-downloader';
