/**
 * Suwayomi Adapter Module
 *
 * Exports the Suwayomi source adapter for integration with the adapter factory.
 *
 * @module adapters/suwayomi
 */

export {
  SuwayomiSourceAdapter,
  getSuwayomiSourceAdapter,
  createSuwayomiSourceAdapter,
} from './SuwayomiSourceAdapter';

export type {
  SuwayomiSourceAdapterConfig,
  SuwayomiMangaSearchResult,
  MultiSourceSearchOptions,
} from './SuwayomiSourceAdapter';
