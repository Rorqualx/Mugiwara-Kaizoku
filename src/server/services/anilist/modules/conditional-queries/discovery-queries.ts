/**
 * Discovery Queries for AniList API
 *
 * Provides trending and seasonal queries with @include/@skip directives
 * for discovery-oriented manga browsing.
 *
 * Extracted from: conditionalQueries.ts (lines 635-794)
 */

/**
 * Build trending query with conditional fields
 *
 * @returns GraphQL query string for trending manga
 *
 * Default Inclusions:
 * - Basic: true (chapters, volumes)
 * - Scores: true (popularity, averageScore, favourites)
 * - Trending: true (trending field)
 * - Tags: true (genres)
 *
 * Optional Inclusions (false by default):
 * - Dates, Stats, Media, Relations, Recommendations
 * - Characters, Staff, Studios, External, Streaming
 *
 * @example
 * ```typescript
 * const query = buildConditionalTrendingQuery();
 * const result = await client.query(query, {
 *   page: 1,
 *   perPage: 20,
 *   includeRelations: true,
 *   includeDates: true
 * });
 * ```
 */
export function buildConditionalTrendingQuery(): string {
  return `
    query ConditionalTrending(
      $page: Int = 1,
      $perPage: Int = 20,
      $includeBasic: Boolean = true,
      $includeDates: Boolean = false,
      $includeScores: Boolean = true,
      $includeStats: Boolean = false,
      $includeMedia: Boolean = false,
      $includeRelations: Boolean = false,
      $includeRecommendations: Boolean = false,
      $includeCharacters: Boolean = false,
      $includeStaff: Boolean = false,
      $includeStudios: Boolean = false,
      $includeExternal: Boolean = false,
      $includeTrending: Boolean = true,
      $includeTags: Boolean = true,
      $includeStreaming: Boolean = false
    ) {
      Page(page: $page, perPage: $perPage) {
        pageInfo {
          total
          currentPage
          lastPage
          hasNextPage
          perPage
        }
        media(sort: TRENDING_DESC, type: MANGA) {
          id
          title {
            romaji
            english
          }
          coverImage {
            large
            medium
          }
          format
          status

          trending @include(if: $includeTrending)
          popularity @include(if: $includeScores)
          averageScore @include(if: $includeScores)
          favourites @include(if: $includeScores)

          chapters @include(if: $includeBasic)
          volumes @include(if: $includeBasic)

          genres @include(if: $includeTags)

          startDate @include(if: $includeDates) {
            year
            month
            day
          }
        }
      }
    }
  `;
}

/**
 * Build seasonal query with conditional fields
 *
 * @returns GraphQL query string for seasonal manga
 *
 * Required Variables:
 * - $season: MediaSeason! - Season (WINTER, SPRING, SUMMER, FALL)
 * - $year: Int! - Year (e.g., 2024)
 *
 * Default Inclusions:
 * - Basic: true (description, chapters, volumes)
 * - Dates: true (startDate, endDate)
 * - Scores: true (averageScore, popularity, favourites)
 * - Media: true (bannerImage, source, countryOfOrigin)
 * - Studios: true (studio edges with isMain and name)
 * - External: true (externalLinks, isLicensed)
 * - Tags: true (genres, tags with name and rank)
 *
 * Optional Inclusions (false by default):
 * - Stats, Relations, Recommendations
 * - Characters, Staff, Trending, Streaming
 *
 * @example
 * ```typescript
 * const query = buildConditionalSeasonalQuery();
 * const result = await client.query(query, {
 *   season: "WINTER",
 *   year: 2024,
 *   page: 1,
 *   perPage: 20,
 *   includeCharacters: true,
 *   includeStaff: true
 * });
 * ```
 */
export function buildConditionalSeasonalQuery(): string {
  return `
    query ConditionalSeasonal(
      $season: MediaSeason!,
      $year: Int!,
      $page: Int = 1,
      $perPage: Int = 20,
      $sort: [MediaSort] = [POPULARITY_DESC, SCORE_DESC],
      $includeBasic: Boolean = true,
      $includeDates: Boolean = true,
      $includeScores: Boolean = true,
      $includeStats: Boolean = false,
      $includeMedia: Boolean = true,
      $includeRelations: Boolean = false,
      $includeRecommendations: Boolean = false,
      $includeCharacters: Boolean = false,
      $includeStaff: Boolean = false,
      $includeStudios: Boolean = true,
      $includeExternal: Boolean = true,
      $includeTrending: Boolean = false,
      $includeTags: Boolean = true,
      $includeStreaming: Boolean = false
    ) {
      Page(page: $page, perPage: $perPage) {
        pageInfo {
          total
          currentPage
          lastPage
          hasNextPage
          perPage
        }
        media(season: $season, seasonYear: $year, type: MANGA, sort: $sort) {
          id
          title {
            romaji
            english
            native
          }
          coverImage {
            large
            medium
          }
          format
          status

          description @include(if: $includeBasic)
          chapters @include(if: $includeBasic)
          volumes @include(if: $includeBasic)

          startDate @include(if: $includeDates) {
            year
            month
            day
          }
          endDate @include(if: $includeDates) {
            year
            month
            day
          }

          averageScore @include(if: $includeScores)
          popularity @include(if: $includeScores)
          favourites @include(if: $includeScores)

          bannerImage @include(if: $includeMedia)
          source @include(if: $includeMedia)
          countryOfOrigin @include(if: $includeMedia)

          genres @include(if: $includeTags)
          tags @include(if: $includeTags) {
            name
            rank
          }

          studios @include(if: $includeStudios) {
            edges {
              isMain
              node {
                name
              }
            }
          }

          externalLinks @include(if: $includeExternal) {
            url
            site
          }
          isLicensed @include(if: $includeExternal)
        }
      }
    }
  `;
}
