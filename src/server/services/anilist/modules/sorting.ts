/**
 * Sorting and Filtering Options for AniList API
 * 
 * This module provides comprehensive sorting and filtering support for AniList GraphQL queries,
 * including sort parameters, date filters, score filters, and seasonal queries.
 */

/**
 * AniList sort options for media queries
 */
export enum MediaSort {
  ID = 'ID',
  ID_DESC = 'ID_DESC',
  TITLE_ROMAJI = 'TITLE_ROMAJI',
  TITLE_ROMAJI_DESC = 'TITLE_ROMAJI_DESC',
  TITLE_ENGLISH = 'TITLE_ENGLISH',
  TITLE_ENGLISH_DESC = 'TITLE_ENGLISH_DESC',
  TITLE_NATIVE = 'TITLE_NATIVE',
  TITLE_NATIVE_DESC = 'TITLE_NATIVE_DESC',
  TYPE = 'TYPE',
  TYPE_DESC = 'TYPE_DESC',
  FORMAT = 'FORMAT',
  FORMAT_DESC = 'FORMAT_DESC',
  START_DATE = 'START_DATE',
  START_DATE_DESC = 'START_DATE_DESC',
  END_DATE = 'END_DATE',
  END_DATE_DESC = 'END_DATE_DESC',
  SCORE = 'SCORE',
  SCORE_DESC = 'SCORE_DESC',
  POPULARITY = 'POPULARITY',
  POPULARITY_DESC = 'POPULARITY_DESC',
  TRENDING = 'TRENDING',
  TRENDING_DESC = 'TRENDING_DESC',
  EPISODES = 'EPISODES',
  EPISODES_DESC = 'EPISODES_DESC',
  DURATION = 'DURATION',
  DURATION_DESC = 'DURATION_DESC',
  STATUS = 'STATUS',
  STATUS_DESC = 'STATUS_DESC',
  CHAPTERS = 'CHAPTERS',
  CHAPTERS_DESC = 'CHAPTERS_DESC',
  VOLUMES = 'VOLUMES',
  VOLUMES_DESC = 'VOLUMES_DESC',
  UPDATED_AT = 'UPDATED_AT',
  UPDATED_AT_DESC = 'UPDATED_AT_DESC',
  SEARCH_MATCH = 'SEARCH_MATCH',
  FAVOURITES = 'FAVOURITES',
  FAVOURITES_DESC = 'FAVOURITES_DESC'
}

/**
 * Media season options
 */
export enum MediaSeason {
  WINTER = 'WINTER',
  SPRING = 'SPRING',
  SUMMER = 'SUMMER',
  FALL = 'FALL'
}

/**
 * Country of origin options
 */
export enum CountryOfOrigin {
  JP = 'JP', // Japan
  KR = 'KR', // South Korea
  CN = 'CN', // China
  TW = 'TW'  // Taiwan
}

/**
 * Advanced filter options for AniList queries
 */
export interface AniListFilterOptions {
  /**
   * Sort options (can be multiple for tiebreakers)
   */
  sort?: MediaSort | MediaSort[];
  
  /**
   * Filter by season
   */
  season?: MediaSeason;
  
  /**
   * Filter by season year
   */
  seasonYear?: number;
  
  /**
   * Filter manga starting after this date (YYYYMMDD format)
   */
  startDate_greater?: number;
  
  /**
   * Filter manga starting before this date (YYYYMMDD format)
   */
  startDate_lesser?: number;
  
  /**
   * Filter manga ending after this date (YYYYMMDD format)
   */
  endDate_greater?: number;
  
  /**
   * Filter manga ending before this date (YYYYMMDD format)
   */
  endDate_lesser?: number;
  
  /**
   * Minimum average score (0-100)
   */
  averageScore_greater?: number;
  
  /**
   * Maximum average score (0-100)
   */
  averageScore_lesser?: number;
  
  /**
   * Minimum popularity
   */
  popularity_greater?: number;
  
  /**
   * Maximum popularity
   */
  popularity_lesser?: number;
  
  /**
   * Filter by country of origin
   */
  countryOfOrigin?: CountryOfOrigin;
  
  /**
   * Include manga with these tags
   */
  tag_in?: string[];
  
  /**
   * Exclude manga with these tags
   */
  tag_not_in?: string[];
  
  /**
   * Include manga from these genres
   */
  genre_in?: string[];
  
  /**
   * Exclude manga from these genres
   */
  genre_not_in?: string[];
  
  /**
   * Minimum chapter count
   */
  chapters_greater?: number;
  
  /**
   * Maximum chapter count
   */
  chapters_lesser?: number;
  
  /**
   * Minimum volume count
   */
  volumes_greater?: number;
  
  /**
   * Maximum volume count
   */
  volumes_lesser?: number;
  
  /**
   * Filter by licensed status
   */
  isLicensed?: boolean;
  
  /**
   * Filter to manga updated after this timestamp
   */
  updatedAt_greater?: number;
  
  /**
   * Filter to manga updated before this timestamp
   */
  updatedAt_lesser?: number;
}

/**
 * Helper to convert date to AniList FuzzyDateInt format
 */
export function dateToFuzzyInt(date: Date | string): number {
  const d = typeof date === 'string' ? new Date(date + 'T00:00:00') : date;
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();
  
  // Format: YYYYMMDD as integer
  return year * 10000 + month * 100 + day;
}

/**
 * Helper to get current season
 */
export function getCurrentSeason(): MediaSeason {
  const month = new Date().getMonth() + 1;
  
  if (month >= 1 && month <= 3) return MediaSeason.WINTER;
  if (month >= 4 && month <= 6) return MediaSeason.SPRING;
  if (month >= 7 && month <= 9) return MediaSeason.SUMMER;
  return MediaSeason.FALL;
}

/**
 * Helper to get season from date
 */
export function getSeasonFromDate(date: Date | string): MediaSeason {
  const d = typeof date === 'string' ? new Date(date) : date;
  const month = d.getMonth() + 1;
  
  if (month >= 1 && month <= 3) return MediaSeason.WINTER;
  if (month >= 4 && month <= 6) return MediaSeason.SPRING;
  if (month >= 7 && month <= 9) return MediaSeason.SUMMER;
  return MediaSeason.FALL;
}

/**
 * Mapping of filter keys that can be directly copied to GraphQL variables.
 * Using a const array allows iteration instead of sequential if statements,
 * reducing complexity from 26 to ~5.
 */
const DIRECT_FILTER_KEYS: ReadonlyArray<keyof AniListFilterOptions> = [
  'season',
  'seasonYear',
  'startDate_greater',
  'startDate_lesser',
  'endDate_greater',
  'endDate_lesser',
  'averageScore_greater',
  'averageScore_lesser',
  'popularity_greater',
  'popularity_lesser',
  'countryOfOrigin',
  'tag_in',
  'tag_not_in',
  'genre_in',
  'genre_not_in',
  'chapters_greater',
  'chapters_lesser',
  'volumes_greater',
  'volumes_lesser',
  'updatedAt_greater',
  'updatedAt_lesser',
] as const;

/**
 * Build filter variables for GraphQL query
 *
 * Uses object mapping pattern to reduce complexity from 26 to ~5.
 * Transforms filter options into GraphQL query variables.
 *
 * @param filters - AniList filter options
 * @returns GraphQL variables object
 */
export function buildFilterVariables(
  filters: AniListFilterOptions = {}
): Record<string, unknown> {
  const variables: Record<string, unknown> = {};

  // Handle sort specially (needs array transformation)
  if (filters.sort !== undefined) {
    variables['sort'] = Array.isArray(filters.sort) ? filters.sort : [filters.sort];
  }

  // Handle isLicensed specially (boolean can be false, so check undefined)
  if (filters.isLicensed !== undefined) {
    variables['isLicensed'] = filters.isLicensed;
  }

  // Copy all direct filter keys
  for (const key of DIRECT_FILTER_KEYS) {
    const value = filters[key];
    if (value !== undefined) {
      variables[key] = value;
    }
  }

  return variables;
}

/**
 * Preset filter configurations for common searches
 */
export class FilterPresets {
  /**
   * Get trending manga
   */
  static trending(): AniListFilterOptions {
    return {
      sort: MediaSort.TRENDING_DESC
    };
  }
  
  /**
   * Get popular manga
   */
  static popular(): AniListFilterOptions {
    return {
      sort: MediaSort.POPULARITY_DESC
    };
  }
  
  /**
   * Get top-rated manga
   */
  static topRated(minScore: number = 75): AniListFilterOptions {
    return {
      sort: MediaSort.SCORE_DESC,
      averageScore_greater: minScore
    };
  }
  
  /**
   * Get recently updated manga
   */
  static recentlyUpdated(): AniListFilterOptions {
    return {
      sort: MediaSort.UPDATED_AT_DESC
    };
  }
  
  /**
   * Get new releases
   */
  static newReleases(): AniListFilterOptions {
    return {
      sort: MediaSort.START_DATE_DESC,
      startDate_greater: dateToFuzzyInt(
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
      )
    };
  }
  
  /**
   * Get seasonal manga
   */
  static seasonal(season?: MediaSeason, year?: number): AniListFilterOptions {
    return {
      season: season ?? getCurrentSeason(),
      seasonYear: year ?? new Date().getFullYear(),
      sort: [MediaSort.POPULARITY_DESC, MediaSort.SCORE_DESC]
    };
  }
  
  /**
   * Get completed manga only
   */
  static completed(): AniListFilterOptions {
    return {
      sort: MediaSort.SCORE_DESC,
      endDate_lesser: dateToFuzzyInt(new Date())
    };
  }
  
  /**
   * Get ongoing manga only
   */
  static ongoing(): AniListFilterOptions {
    return {
      sort: MediaSort.POPULARITY_DESC,
      endDate_greater: dateToFuzzyInt(new Date())
    };
  }
  
  /**
   * Get manga from specific country
   */
  static byCountry(country: CountryOfOrigin): AniListFilterOptions {
    return {
      countryOfOrigin: country,
      sort: MediaSort.POPULARITY_DESC
    };
  }
  
  /**
   * Get manga within date range
   */
  static dateRange(startDate: Date, endDate: Date): AniListFilterOptions {
    return {
      startDate_greater: dateToFuzzyInt(startDate),
      startDate_lesser: dateToFuzzyInt(endDate),
      sort: MediaSort.START_DATE_DESC
    };
  }
}

/**
 * Query builder for advanced search queries
 */
export class AdvancedSearchQueryBuilder {
  private filters: AniListFilterOptions = {};
  
  /**
   * Set sort order
   */
  sortBy(sort: MediaSort | MediaSort[]): this {
    this.filters.sort = sort;
    return this;
  }
  
  /**
   * Filter by season
   */
  inSeason(season: MediaSeason, year?: number): this {
    this.filters.season = season;
    if (year) this.filters.seasonYear = year;
    return this;
  }
  
  /**
   * Filter by score range
   */
  withScoreRange(min?: number, max?: number): this {
    if (min !== undefined) this.filters.averageScore_greater = min;
    if (max !== undefined) this.filters.averageScore_lesser = max;
    return this;
  }
  
  /**
   * Filter by popularity range
   */
  withPopularityRange(min?: number, max?: number): this {
    if (min !== undefined) this.filters.popularity_greater = min;
    if (max !== undefined) this.filters.popularity_lesser = max;
    return this;
  }
  
  /**
   * Filter by genres
   */
  withGenres(include?: string[], exclude?: string[]): this {
    if (include) this.filters.genre_in = include;
    if (exclude) this.filters.genre_not_in = exclude;
    return this;
  }
  
  /**
   * Filter by tags
   */
  withTags(include?: string[], exclude?: string[]): this {
    if (include) this.filters.tag_in = include;
    if (exclude) this.filters.tag_not_in = exclude;
    return this;
  }
  
  /**
   * Filter by date range
   */
  startedBetween(startDate?: Date, endDate?: Date): this {
    if (startDate) this.filters.startDate_greater = dateToFuzzyInt(startDate);
    if (endDate) this.filters.startDate_lesser = dateToFuzzyInt(endDate);
    return this;
  }
  
  /**
   * Filter by chapter count
   */
  withChapterRange(min?: number, max?: number): this {
    if (min !== undefined) this.filters.chapters_greater = min;
    if (max !== undefined) this.filters.chapters_lesser = max;
    return this;
  }
  
  /**
   * Filter by country
   */
  fromCountry(country: CountryOfOrigin): this {
    this.filters.countryOfOrigin = country;
    return this;
  }
  
  /**
   * Filter by licensed status
   */
  onlyLicensed(licensed: boolean = true): this {
    this.filters.isLicensed = licensed;
    return this;
  }
  
  /**
   * Build the filter options
   */
  build(): AniListFilterOptions {
    return { ...this.filters };
  }
  
  /**
   * Build as GraphQL variables
   */
  buildVariables(): Record<string, unknown> {
    return buildFilterVariables(this.filters);
  }
  
  /**
   * Reset all filters
   */
  reset(): this {
    this.filters = {};
    return this;
  }
}