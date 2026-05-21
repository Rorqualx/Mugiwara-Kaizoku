/**
 * Type definitions for ComicVine API
 */

/**
 * ComicVine API response structure
 */
export interface ComicVineData {
  id?: number | string;
  name?: string;
  site_detail_url?: string;
  siteDetailUrl?: string;
  api_detail_url?: string;
  issueCount?: number;
  count_of_issues?: number;
  issues?: Array<Record<string, unknown>>;
  aliases?: string;
  deck?: string;
  description?: string;
  image?: {
    original_url?: string;
    medium_url?: string;
    small_url?: string;
  };
  start_year?: string | number;
  publisher?: {
    name?: string;
  };
  last_issue?: {
    cover_date?: string;
  };
  /** People who worked on the comic (writers, artists, etc.) */
  person_credits?: Array<{
    name?: string;
    role?: string;
  }>;
  /** Genres associated with the comic */
  genres?: Array<{
    name: string;
  }>;
}

/**
 * ComicVine mutations for API calls
 */
export interface ComicVineMutations {
  fetchComicvineVolumeDetailsMutation: {
    mutateAsync: (params: Record<string, unknown>) => Promise<unknown>;
  };
  scrapeComicVineChaptersMutation?: {
    mutateAsync: (params: Record<string, unknown>) => Promise<unknown>;
  };
  scrapeComicVineVolumeUrlsMutation?: {
    mutateAsync: (params: Record<string, unknown>) => Promise<unknown>;
  };
  scrapeComicVineVolumeMutation?: {
    mutateAsync: (params: Record<string, unknown>) => Promise<unknown>;
  };
}

/**
 * Scraped chapter data structure
 */
export interface ScrapedData {
  scrapedChapterCount: number;
  scrapedChapterData: unknown[];
  volumeData: unknown[];
  /** Indicates if volume data came from API (covers available) but chapters need scraping */
  fromApi?: boolean;
  /** Volume URLs for background chapter scraping */
  volumeUrls?: Array<{ volumeNumber: number; url: string }>;
}

/**
 * Callback for when chapters are loaded in background
 */
export type OnChaptersLoaded = (chaptersMetadata: import('@/types/universalImportWizard.types').ProviderMetadata) => void;
