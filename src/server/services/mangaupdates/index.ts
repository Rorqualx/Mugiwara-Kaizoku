/**
 * MangaUpdates Service - Barrel Export
 */

export { mangaUpdatesService, type MUReleaseRecord, type MUSearchHit, type MUSeriesDetails } from './service';
export { adaptMUSearchResult, adaptMUToMangaMetadata } from './adapter';
export type {
  MUReleaseSearchResponse,
  MUSearchResponse,
  MUSearchRecord,
  MUPublisher,
  MUAuthor,
  MUCategory,
  MUGenre,
  MURecommendation,
  MURelatedSeries,
  MUAnimeRelation,
  MUPublication,
} from './types';
