/**
 * Chapter Operations Handlers for Universal Import Wizard
 *
 * Provides hooks for chapter-related operations including:
 * - Batch fetching chapter cover images
 * - On-hover chapter metadata fetching
 * - ComicVine chapter scraping from volume URLs
 *
 * @module chapter-handlers
 * @provenance Extracted from UniversalImportWizard.tsx lines 476-564
 */

import { useCallback } from 'react';

import type {
  MediaGallery,
  ProviderMetadata,
  Volume,
  VolumesData
} from '@/types/universalImportWizard.types';
import { logger } from '@/utils/logger';
import { notify } from '@/utils/notify';

import type { ChapterFetchingService } from '../services/chapterFetchingService';
import type { Mutation } from '../services/sourceManagementService/types';

/**
 * Result from ComicVine volume scraping
 */
interface VolumeDetails {
  volumeNumber?: number;
  title?: string;
  coverImageUrl?: string;
  coverUrl?: string;
  coverImage?: string;
  chapterCount?: number;
  chapters?: unknown[];
  pageCount?: number;
  releaseDate?: string;
  isbn?: string;
  description?: string;
  url?: string;
  [key: string]: unknown;
}

interface ComicVineVolumeResult {
  data?: {
    volumeDetails?: VolumeDetails[];
    metadata?: Record<string, unknown>;
    chapters?: number;
    totalChapters?: number;
  };
}

/**
 * Parameters for chapter handlers hook
 */
export interface ChapterHandlersParams {
  volumesData: VolumesData;
  chapterFetchingService: ChapterFetchingService;
  scrapeComicVineVolumeMutation: Mutation;
  setMediaGallery: React.Dispatch<React.SetStateAction<MediaGallery>>;
  setVolumesData: React.Dispatch<React.SetStateAction<VolumesData>>;
  setSelectedSourcesMetadata: React.Dispatch<React.SetStateAction<Record<string, ProviderMetadata>>>;
  setLoadingChapterMetadata: React.Dispatch<React.SetStateAction<boolean>>;
  logger: typeof logger;
}

/**
 * Return type for chapter handlers hook
 */
export interface ChapterHandlers {
  handleBatchFetchChapterCovers: () => Promise<void>;
  fetchChapterMetadataOnHover: (chapterUrl: string) => Promise<unknown>;
  handleComicVineChapterScraping: (volumeNumber: number) => Promise<void>;
}

/**
 * Hook providing chapter-related handlers for the Universal Import Wizard
 *
 * @param params - Configuration object containing services and state setters
 * @returns Object containing chapter operation handlers
 *
 * @example
 * ```typescript
 * const { handleBatchFetchChapterCovers, fetchChapterMetadataOnHover } = useChapterHandlers({
 *   volumesData,
 *   chapterFetchingService,
 *   scrapeComicVineVolumeMutation,
 *   setMediaGallery,
 *   setVolumesData,
 *   setSelectedSourcesMetadata,
 *   setLoadingChapterMetadata,
 *   logger
 * });
 * ```
 */
export function useChapterHandlers(params: ChapterHandlersParams): ChapterHandlers {
  const {
    volumesData,
    chapterFetchingService,
    scrapeComicVineVolumeMutation,
    setMediaGallery,
    setVolumesData,
    setSelectedSourcesMetadata,
    setLoadingChapterMetadata,
    logger: _logger
  } = params;

  /**
   * Batch fetch chapter cover images for all chapters across all volumes
   *
   * Extracts all chapter URLs from volumesData and fetches their cover images
   * using the chapter fetching service. Updates media gallery with results.
   */
  const handleBatchFetchChapterCovers = useCallback(async (): Promise<void> => {
    const allChapterUrls: unknown[] = [];
    volumesData.volumes.forEach((volume: unknown) => {
      const volumeObj = volume as Record<string, unknown>;
      const chapters = volumeObj["chapters"];
      if (Array.isArray(chapters)) {
        allChapterUrls.push(...(chapters as unknown[]));
      }
    });

    await chapterFetchingService.batchFetchChapterCovers(
      allChapterUrls,
      {
        setMediaGallery: (updater: (prev: unknown) => unknown) => {
          setMediaGallery(prev => updater(prev) as MediaGallery);
        }
      }
    );
  }, [volumesData.volumes, chapterFetchingService, setMediaGallery]);

  /**
   * Fetch chapter metadata when user hovers over a chapter
   *
   * @param chapterUrl - URL of the chapter to fetch metadata for
   * @returns Promise resolving to chapter metadata
   */
  const fetchChapterMetadataOnHover = useCallback(async (chapterUrl: string): Promise<unknown> => {
    return chapterFetchingService.fetchChapterMetadataOnHover(
      chapterUrl,
      {
        setLoadingChapterMetadata: () => setLoadingChapterMetadata(true)
      }
    );
  }, [chapterFetchingService, setLoadingChapterMetadata]);

  /**
   * Scrape ComicVine volume to fetch chapter details
   *
   * Finds the volume by number, scrapes its ComicVine URL for chapter data,
   * and updates both volumesData and selectedSourcesMetadata with results.
   *
   * @param volumeNumber - Volume number to scrape chapters for
   */
  const handleComicVineChapterScraping = useCallback(async (volumeNumber: number): Promise<void> => {
    try {
      const volume = volumesData.volumes.find((v: unknown) => {
        const vObj = v as Record<string, unknown>;
        return vObj["volumeNumber"] === volumeNumber;
      }) as Record<string, unknown> | undefined;

      if (volume?.["url"]) {
        const result = await scrapeComicVineVolumeMutation.mutateAsync({
          volumeUrl: volume["url"] as string
        }) as ComicVineVolumeResult;

        if (result.data?.volumeDetails?.[0]) {
          const scrapedData = result.data.volumeDetails[0];

          // Update volumesData
          setVolumesData(prev => ({
            ...prev,
            volumes: prev.volumes.map((v: unknown) => {
              const vObj = v as Record<string, unknown>;
              return vObj["volumeNumber"] === volumeNumber
                ? { ...vObj, ...scrapedData } as Volume
                : v as Volume;
            })
          }));

          // Also update selectedSourcesMetadata.comicvine.volumeData
          setSelectedSourcesMetadata((prev: Record<string, ProviderMetadata>) => {
            const comicvineKey = prev['COMICVINE'] ? 'COMICVINE' : 'comicvine';
            const comicvineMetadata = prev[comicvineKey];

            if (comicvineMetadata?.volumeData) {
              const updatedVolumeData = comicvineMetadata.volumeData.map((v: unknown) => {
                const vObj = v as Record<string, unknown>;
                return vObj["volumeNumber"] === volumeNumber ? { ...vObj, ...scrapedData } : v;
              });

              return {
                ...prev,
                [comicvineKey]: {
                  ...comicvineMetadata,
                  volumeData: updatedVolumeData
                } as ProviderMetadata
              };
            }
            return prev;
          });

          notify({ severity: 'SUCCESS', title: 'ComicVine Chapters Scraped', message: `Successfully scraped ${scrapedData["chapters"]?.length ?? 0} chapters` });
        }
      }
    } catch (_error) {
      notify({ severity: 'ERROR', title: 'Scraping Failed', message: 'Could not scrape ComicVine volume' });
    }
  }, [
    volumesData.volumes,
    scrapeComicVineVolumeMutation,
    setVolumesData,
    setSelectedSourcesMetadata
  ]);

  return {
    handleBatchFetchChapterCovers,
    fetchChapterMetadataOnHover,
    handleComicVineChapterScraping
  };
}
