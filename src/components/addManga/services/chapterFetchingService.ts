import { notifications } from '@mantine/notifications';

import type { Chapter, MediaGallery } from '@/types/universalImportWizard.types';
import { isSuccess, createSuccessResult, createErrorResult, createContextualError } from '@/utils/async-result';
import { logger } from '@/utils/logger';
import { notify } from '@/utils/notify';
/**
 * Service for handling chapter metadata and cover fetching
 */

/**
 * Type guard to check if value is a valid Chapter object
 */
function isChapterObject(value: unknown): value is { url: string; [key: string]: unknown } {
  return typeof value === 'object' && value !== null && 'url' in value && typeof (value as Record<string, unknown>)['url'] === 'string';
}

export interface ChapterFetchingServiceConfig {
  fetchFandomChapterMetadata: {
    mutateAsync: (params: { url: string; forceRefresh?: boolean }) => Promise<unknown>;
  };
}

export interface ChapterMetadata {
  title?: string;
  summary?: string;
  description?: string;
  coverImageUrl?: string;
  volumeNumber?: number;
  chapterNumber?: number;
  releaseDate?: string;
  url?: string;
}

export interface BatchFetchProgress {
  current: number;
  total: number;
}

export class ChapterFetchingService {
  private mutations: ChapterFetchingServiceConfig;
  private chapterMetadataCache: Map<string, ChapterMetadata>;
  private loadingChapterMetadata: string | null = null;

  constructor(mutations: ChapterFetchingServiceConfig) {
    this.mutations = mutations;
    this.chapterMetadataCache = new Map();
  }

  /**
   * Get the current cache
   */
  getCache(): Map<string, ChapterMetadata> {
    return new Map(this.chapterMetadataCache);
  }

  /**
   * Set the entire cache (useful for restoring state)
   */
  setCache(cache: Map<string, ChapterMetadata>): void {
    this.chapterMetadataCache = new Map(cache);
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.chapterMetadataCache.clear();
  }

  /**
   * Check if a URL is in cache
   */
  hasInCache(url: string): boolean {
    return this.chapterMetadataCache.has(url);
  }

  /**
   * Get metadata from cache
   */
  getFromCache(url: string): ChapterMetadata | null {
    const cached = this.chapterMetadataCache.get(url);
    return cached ?? null;
  }

  /**
   * Fetch metadata for a single chapter (typically on hover)
   */
  async fetchChapterMetadataOnHover(
    chapterUrl: string,
    callbacks?: {
      setLoadingChapterMetadata?: (url: string | null) => void;
    }
  ): Promise<ChapterMetadata | null> {
    // Check if already in cache
    if (this.chapterMetadataCache.has(chapterUrl)) {
      const cached = this.chapterMetadataCache.get(chapterUrl);
      logger.info('Chapter metadata from cache:', {
        chapterUrl,
        metadata: cached
      });
      return cached ?? null;
    }

    // Check if already loading
    if (this.loadingChapterMetadata === chapterUrl) {
      logger.info('Already loading chapter metadata for:', { data: chapterUrl });
      return null;
    }

    logger.info('Fetching chapter metadata for:', { data: chapterUrl });
    this.loadingChapterMetadata = chapterUrl;
    
    if (callbacks?.setLoadingChapterMetadata) {
      callbacks.setLoadingChapterMetadata(chapterUrl);
    }

    try {
      const result = await this.mutations.fetchFandomChapterMetadata.mutateAsync({
        url: chapterUrl
      });

      logger.info('Chapter metadata fetch result:', { data: result });

      const chapterData = result as ChapterMetadata;
      logger.info('Chapter metadata fetched successfully:', { data: chapterData });

      // Add to cache
      this.chapterMetadataCache.set(chapterUrl, chapterData);
      return chapterData;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to fetch chapter metadata:', errorMessage);
    } finally {
      this.loadingChapterMetadata = null;
      
      if (callbacks?.setLoadingChapterMetadata) {
        callbacks.setLoadingChapterMetadata(null);
      }
    }

    return null;
  }

  /**
   * Batch fetch chapter metadata for multiple chapters
   */
  async batchFetchChapterMetadata(
    chapterUrls: string[],
    callbacks: {
      setIsBatchFetching?: (fetching: boolean) => void;
      setBatchFetchProgress?: (progress: BatchFetchProgress) => void;
      setChapterMetadataCache?: (cache: Map<string, ChapterMetadata>) => void;
      onChapterCoverFound?: (chapterIndex: number, coverUrl: string) => void;
      allChapterUrls?: unknown[];
    }
  ): Promise<void> {
    logger.info('batchFetchChapterMetadata called with URLs:', { data: chapterUrls });
    logger.info('Current cache size:', { data: this.chapterMetadataCache.size });

    // Filter out chapters that are already cached
    const urlsToFetch = chapterUrls.filter(url => !this.chapterMetadataCache.has(url));

    if (urlsToFetch.length === 0) {
      logger.info('All chapter metadata already cached');
      notify({ severity: 'INFO', title: 'Chapter Details Ready', message: 'All chapter details are already loaded' });
      return;
    }

    logger.info(`Batch fetching metadata for ${urlsToFetch.length} chapters`);
    logger.info('First 5 URLs to fetch:', { data: urlsToFetch.slice(0, 5) });

    // Show notification that fetching has started
    notifications.show({
      id: 'chapter-fetch',
      title: 'Fetching Chapter Details',
      message: `Loading summaries and cover art for ${urlsToFetch.length} chapters...`,
      color: 'blue',
      loading: true,
      autoClose: false
    });

    if (callbacks.setIsBatchFetching) {
      callbacks.setIsBatchFetching(true);
    }

    if (callbacks.setBatchFetchProgress) {
      callbacks.setBatchFetchProgress({
        current: 0,
        total: urlsToFetch.length
      });
    }

    const newCache = new Map(this.chapterMetadataCache);

    // Helper function to handle chapter cover found callback
    const handleChapterCoverFound = (url: string, coverUrl: string): void => {
      if (!callbacks.onChapterCoverFound || !callbacks.allChapterUrls) {
        return;
      }

      const chapterIndex = callbacks.allChapterUrls.findIndex((ch: unknown) => {
        return isChapterObject(ch) && ch.url === url;
      });

      logger.info(`Setting cover for chapter at index ${chapterIndex}`, {
        url,
        coverUrl,
        allChapterUrlsLength: callbacks.allChapterUrls.length
      });

      if (chapterIndex !== -1) {
        callbacks.onChapterCoverFound(chapterIndex, coverUrl);
      } else {
        logger.warn(`Could not find chapter index for URL: ${url}`);
      }
    };

    // Helper function to fetch with retry logic
    const fetchWithRetry = async (url: string): Promise<{ url: string; success: boolean; data?: ChapterMetadata; error?: unknown }> => {
      const maxRetries = 3;
      let lastError: unknown = null;

      // Sequential retries with exponential backoff are intentional (await in loop is expected)
      /* eslint-disable no-await-in-loop */
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          logger.info(`Fetching metadata for: ${url} (attempt ${attempt}/${maxRetries})`);

          const result = await this.mutations.fetchFandomChapterMetadata.mutateAsync({
            url,
            forceRefresh: attempt > 1 // Force refresh on retries
          });

          logger.info(`Result for ${url}:`, { data: result });

          const chapterData = result as ChapterMetadata;
          newCache.set(url, chapterData);
          logger.info(`Successfully cached metadata for: ${url}`, { data: chapterData });

          // Handle chapter cover art if available
          if (chapterData.coverImageUrl) {
            handleChapterCoverFound(url, chapterData.coverImageUrl);
          }

          return {
            url,
            success: true,
            data: chapterData
          };
        } catch (error) {
          logger.error(`Error fetching metadata for ${url} (attempt ${attempt}):`, error);
          lastError = error;

          // If not the last attempt, wait before retrying
          if (attempt < maxRetries) {
            const delay = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
            logger.info(`Retrying ${url} in ${delay}ms...`);
            await new Promise<void>(resolve => { setTimeout(resolve, delay); });
          }
        }
      }
      /* eslint-enable no-await-in-loop */

      // All retries failed
      logger.error(`Failed to fetch metadata for ${url} after ${maxRetries} attempts`);
      return {
        url,
        success: false,
        error: lastError
      };
    };

    // Process all URLs with concurrency limit
    const batchSize = 5;
    const allPromises: Promise<{ url: string; success: boolean; data?: ChapterMetadata; error?: unknown }>[] = [];

    for (let i = 0; i < urlsToFetch.length; i += batchSize) {
      const batch = urlsToFetch.slice(i, Math.min(i + batchSize, urlsToFetch.length));
      logger.info(`Processing batch ${Math.floor(i / batchSize) + 1}, URLs:`, batch);

      allPromises.push(...batch.map(url => fetchWithRetry(url)));
    }

    // Wait for all fetches to complete
    const allResults = await Promise.all(allPromises);

    // Update final progress
    if (callbacks.setBatchFetchProgress) {
      callbacks.setBatchFetchProgress({
        current: urlsToFetch.length,
        total: urlsToFetch.length
      });
    }

    // Update progress notification
    notifications.update({
      id: 'chapter-fetch',
      title: 'Fetching Chapter Details',
      message: `Loading summaries and cover art... ${urlsToFetch.length}/${urlsToFetch.length}`,
      color: 'blue',
      loading: true,
      autoClose: false
    });

    logger.info(`All batches complete. Total results: ${allResults.length}`);

    // Update the internal cache
    this.chapterMetadataCache = newCache;

    // Update external cache if callback provided
    if (callbacks.setChapterMetadataCache) {
      callbacks.setChapterMetadataCache(newCache);
    }

    if (callbacks.setIsBatchFetching) {
      callbacks.setIsBatchFetching(false);
    }

    if (callbacks.setBatchFetchProgress) {
      callbacks.setBatchFetchProgress({
        current: 0,
        total: 0
      });
    }

    // Show completion notification
    notifications.update({
      id: 'chapter-fetch',
      title: 'Chapter Details Loaded',
      message: `Successfully loaded details for ${urlsToFetch.length} chapters`,
      color: 'green',
      loading: false,
      autoClose: 3000
    });

    logger.info('Batch fetch complete. Final cache size:', { data: newCache.size });
    logger.info('Cache contents:', { data: Array.from(newCache.entries()) });
  }

  /**
   * Fetch chapter covers in bulk (without fetching full metadata)
   */
  async batchFetchChapterCovers(
    chapters: unknown[],
    callbacks: {
      setMediaGallery: (updater: (prev: unknown) => unknown) => void;
      notifications?: typeof notifications;
    }
  ): Promise<void> {
    const chaptersWithoutCovers = chapters.filter((chapter, _idx) => {
      // Check if chapter has a URL and no cover yet
      if (!isChapterObject(chapter)) return false;
      return chapter.url && !chapter['coverImageUrl'] && !chapter['coverUrl'];
    });

    if (chaptersWithoutCovers.length === 0) {
      logger.info('All chapters already have covers or no URLs available');
      return;
    }

    const notificationSystem = callbacks.notifications ?? notifications;

    notificationSystem.show({
      id: 'bulk-refresh-chapters',
      title: 'Fetching Missing Chapter Covers',
      message: `Fetching covers for ${chaptersWithoutCovers.length} chapters...`,
      loading: true,
      autoClose: false
    });

    let successCount = 0;

    // Fetch all chapter covers in parallel
    const allCoverPromises = chaptersWithoutCovers.map(async (chapter: unknown) => {
      // Type guard for chapter
      if (!isChapterObject(chapter)) {
        return createErrorResult(
          createContextualError('Invalid chapter object', 'INVALID_CHAPTER', { chapter })
        );
      }

      const chapterUrl = chapter.url;

      try {
        // First check cache
        const cachedMetadata = this.chapterMetadataCache.get(chapterUrl);
        if (cachedMetadata?.coverImageUrl) {
          return createSuccessResult({ coverUrl: cachedMetadata.coverImageUrl, chapter: chapter as Chapter });
        }

        // Fetch metadata to get cover
        const metadata = await this.fetchChapterMetadataOnHover(chapterUrl);

        if (metadata?.coverImageUrl) {
          successCount++;
          return createSuccessResult({ coverUrl: metadata.coverImageUrl, chapter: chapter as Chapter });
        }

        return createErrorResult(
          createContextualError('No cover found', 'NO_COVER_FOUND', { chapter })
        );
      } catch (error) {
        logger.error(`Failed to fetch cover for chapter:`, error);
        return createErrorResult(
          createContextualError(
            error instanceof Error ? error.message : 'Failed to fetch cover',
            'COVER_FETCH_ERROR',
            { chapter }
          )
        );
      }
    });

    const allResults = await Promise.all(allCoverPromises);

    // Update covers in mediaGallery
    allResults.forEach(result => {
      if (isSuccess(result)) {
        const data = result.data as { coverUrl?: string; chapter: Chapter };
        const coverUrl = data.coverUrl;
        if (coverUrl) {
          const chapterIndex = chapters.indexOf(data.chapter);
          if (chapterIndex !== -1) {
            callbacks.setMediaGallery((prev: unknown) => {
              // Type guard for prev
              if (typeof prev !== 'object' || prev === null) {
                return prev;
              }

              const mediaGallery = prev as MediaGallery;
              const newCovers = [...mediaGallery.chapterCovers];
              // Ensure array is large enough
              while (newCovers.length <= chapterIndex) {
                newCovers.push('');
              }
              newCovers[chapterIndex] = coverUrl;
              return { ...mediaGallery, chapterCovers: newCovers };
            });
          }
        }
      }
    });

    // Update final progress
    notificationSystem.update({
      id: 'bulk-refresh-chapters',
      title: 'Fetching Chapter Covers',
      message: `Progress: ${chaptersWithoutCovers.length}/${chaptersWithoutCovers.length}`,
      loading: true,
      autoClose: false
    });

    // Show completion notification
    if (successCount > 0) {
      notificationSystem.update({
        id: 'bulk-refresh-chapters',
        title: 'Chapter Covers Updated',
        message: `Successfully fetched ${successCount} chapter covers`,
        color: 'green',
        loading: false,
        autoClose: 3000
      });
    } else {
      notificationSystem.update({
        id: 'bulk-refresh-chapters',
        title: 'No Covers Found',
        message: 'No chapter covers were available',
        color: 'yellow',
        loading: false,
        autoClose: 3000
      });
    }
  }
}

export default ChapterFetchingService;