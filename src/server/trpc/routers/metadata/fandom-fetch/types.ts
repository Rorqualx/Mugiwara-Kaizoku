/**
 * Type definitions for Fandom metadata fetch
 */

/**
 * Fandom metadata result type
 */
export type FandomMetadata = {
  url: string;
  title?: string;
  cover?: string;
  description?: string;
  alternativeTitles?: string[];
  genres?: string[];
  authors?: string[];
  status?: string;
  myAnimeListUrl?: string;
  myAnimeListId?: number;
  startDate?: string;
  endDate?: string;
};

/**
 * Cheerio element type for type safety
 */
export type CheerioElement = ReturnType<ReturnType<typeof import('cheerio').load>>;
