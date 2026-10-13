/**
 * Manga Detail Page Hooks
 *
 * Custom hooks for the manga detail page component decomposition.
 * These hooks encapsulate state management, data fetching, and business logic
 * for the manga detail page.
 *
 * @module hooks/manga
 */

export { useMangaDetailPageState } from './useMangaDetailPageState';
export type { MangaDetailPageState } from './useMangaDetailPageState';
export { useMangaDetailModals } from './useMangaDetailModals';
export { useMangaDetailData } from './useMangaDetailData';
export { useMangaMetadataExtraction } from './useMangaMetadataExtraction';
export { useMangaProviderCheck } from './useMangaProviderCheck';
export { useMangaDetailMutations } from './useMangaDetailMutations';

// Re-export chapter updates hook for real-time updates
export { useChapterUpdates, showChapterScrapingNotification } from './useChapterUpdates';
