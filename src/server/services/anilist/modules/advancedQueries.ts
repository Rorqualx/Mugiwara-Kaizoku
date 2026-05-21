/**
 * Advanced GraphQL Queries for AniList API
 * 
 * This module provides enhanced queries that support sorting, filtering,
 * and other advanced search capabilities.
 */

import { FragmentBuilder } from './fragments';

/**
 * Build advanced search query with all filter parameters
 */
export function buildAdvancedSearchQuery(includeFragments: boolean = true): string {
  const builder = new FragmentBuilder();
  const fragments = includeFragments ? builder.use('MediaSearch').build() : '';
  
  return `
    ${fragments}
    
    query AdvancedMangaSearch(
      $search: String
      $page: Int
      $perPage: Int
      
      # Basic filters
      $genres: [String]
      $genre_in: [String]
      $genre_not_in: [String]
      $tag_in: [String]
      $tag_not_in: [String]
      $format: MediaFormat
      $status: MediaStatus
      $isAdult: Boolean
      $isLicensed: Boolean
      $countryOfOrigin: CountryCode
      
      # Sorting
      $sort: [MediaSort]
      
      # Season filters
      $season: MediaSeason
      $seasonYear: Int
      
      # Date filters
      $startDate_greater: FuzzyDateInt
      $startDate_lesser: FuzzyDateInt
      $endDate_greater: FuzzyDateInt
      $endDate_lesser: FuzzyDateInt
      
      # Score and popularity filters
      $averageScore_greater: Int
      $averageScore_lesser: Int
      $popularity_greater: Int
      $popularity_lesser: Int
      
      # Chapter and volume filters
      $chapters_greater: Int
      $chapters_lesser: Int
      $volumes_greater: Int
      $volumes_lesser: Int
      
      # Update time filters
      $updatedAt_greater: Int
      $updatedAt_lesser: Int
    ) {
      Page(page: $page, perPage: $perPage) {
        pageInfo {
          total
          currentPage
          lastPage
          hasNextPage
          perPage
        }
        media(
          search: $search
          type: MANGA
          
          # Apply all filters
          genre_in: $genre_in
          genre_not_in: $genre_not_in
          tag_in: $tag_in
          tag_not_in: $tag_not_in
          format: $format
          status: $status
          isAdult: $isAdult
          isLicensed: $isLicensed
          countryOfOrigin: $countryOfOrigin
          
          sort: $sort
          
          season: $season
          seasonYear: $seasonYear
          
          startDate_greater: $startDate_greater
          startDate_lesser: $startDate_lesser
          endDate_greater: $endDate_greater
          endDate_lesser: $endDate_lesser
          
          averageScore_greater: $averageScore_greater
          averageScore_lesser: $averageScore_lesser
          popularity_greater: $popularity_greater
          popularity_lesser: $popularity_lesser
          
          chapters_greater: $chapters_greater
          chapters_lesser: $chapters_lesser
          volumes_greater: $volumes_greater
          volumes_lesser: $volumes_lesser
          
          updatedAt_greater: $updatedAt_greater
          updatedAt_lesser: $updatedAt_lesser
        ) {
          ${includeFragments ? '...MediaSearch' : `
            id
            title {
              romaji
              english
              native
            }
            description
            coverImage {
              large
              medium
            }
            status
            chapters
            volumes
            format
            genres
            averageScore
            popularity
            isAdult
            startDate {
              year
              month
              day
            }
            endDate {
              year
              month
              day
            }
          `}
        }
      }
    }
  `;
}

/**
 * Build trending manga query
 */
export function buildTrendingQuery(includeFragments: boolean = true): string {
  const builder = new FragmentBuilder();
  const fragments = includeFragments ? builder.use('MediaListItem').build() : '';
  
  return `
    ${fragments}
    
    query TrendingManga($page: Int, $perPage: Int, $isAdult: Boolean) {
      Page(page: $page, perPage: $perPage) {
        pageInfo {
          total
          currentPage
          lastPage
          hasNextPage
          perPage
        }
        media(type: MANGA, sort: TRENDING_DESC, isAdult: $isAdult) {
          ${includeFragments ? '...MediaListItem' : `
            id
            title {
              romaji
              english
            }
            coverImage {
              medium
            }
            status
            format
            chapters
            volumes
          `}
          trending
        }
      }
    }
  `;
}

/**
 * Build seasonal manga query
 */
export function buildSeasonalQuery(includeFragments: boolean = true): string {
  const builder = new FragmentBuilder();
  const fragments = includeFragments ? builder.use('MediaSearch').build() : '';
  
  return `
    ${fragments}
    
    query SeasonalManga(
      $season: MediaSeason!
      $seasonYear: Int!
      $page: Int
      $perPage: Int
      $sort: [MediaSort]
      $isAdult: Boolean
    ) {
      Page(page: $page, perPage: $perPage) {
        pageInfo {
          total
          currentPage
          lastPage
          hasNextPage
          perPage
        }
        media(
          type: MANGA
          season: $season
          seasonYear: $seasonYear
          sort: $sort
          isAdult: $isAdult
        ) {
          ${includeFragments ? '...MediaSearch' : `
            id
            title {
              romaji
              english
              native
            }
            description
            coverImage {
              large
              medium
            }
            status
            chapters
            volumes
            format
            genres
            averageScore
            popularity
            isAdult
            seasonYear
            season
          `}
        }
      }
    }
  `;
}

/**
 * Build top rated manga query
 */
export function buildTopRatedQuery(includeFragments: boolean = true): string {
  const builder = new FragmentBuilder();
  const fragments = includeFragments ? builder.use('MediaSearch').build() : '';
  
  return `
    ${fragments}
    
    query TopRatedManga(
      $page: Int
      $perPage: Int
      $minScore: Int
      $isAdult: Boolean
    ) {
      Page(page: $page, perPage: $perPage) {
        pageInfo {
          total
          currentPage
          lastPage
          hasNextPage
          perPage
        }
        media(
          type: MANGA
          sort: SCORE_DESC
          averageScore_greater: $minScore
          isAdult: $isAdult
        ) {
          ${includeFragments ? '...MediaSearch' : `
            id
            title {
              romaji
              english
              native
            }
            description
            coverImage {
              large
              medium
            }
            status
            chapters
            volumes
            format
            genres
            averageScore
            popularity
            isAdult
          `}
        }
      }
    }
  `;
}

/**
 * Build recently updated manga query
 */
export function buildRecentlyUpdatedQuery(includeFragments: boolean = true): string {
  const builder = new FragmentBuilder();
  const fragments = includeFragments ? builder.use('MediaListItem').build() : '';
  
  return `
    ${fragments}
    
    query RecentlyUpdatedManga(
      $page: Int
      $perPage: Int
      $isAdult: Boolean
    ) {
      Page(page: $page, perPage: $perPage) {
        pageInfo {
          total
          currentPage
          lastPage
          hasNextPage
          perPage
        }
        media(
          type: MANGA
          sort: UPDATED_AT_DESC
          isAdult: $isAdult
        ) {
          ${includeFragments ? '...MediaListItem' : `
            id
            title {
              romaji
              english
            }
            coverImage {
              medium
            }
            status
            format
            chapters
            volumes
          `}
          updatedAt
        }
      }
    }
  `;
}