/**
 * Conditional Advanced Search Query for AniList API
 *
 * Builds a comprehensive search query with all available filter options
 * and @include/@skip directives for optimal performance.
 *
 * Extracted from: conditionalQueries.ts (lines 477-634)
 */

/**
 * Build advanced search query with all filter options and conditional fields
 *
 * @returns GraphQL query string with comprehensive filtering
 *
 * Filter Variables:
 * - $search: String - Search term
 * - $page: Int - Page number (default: 1)
 * - $perPage: Int - Results per page (default: 20)
 * - $sort: [MediaSort] - Sort options
 * - $season: MediaSeason - Season filter
 * - $seasonYear: Int - Year filter
 * - $startDate_greater: FuzzyDateInt - Start date minimum
 * - $startDate_lesser: FuzzyDateInt - Start date maximum
 * - $endDate_greater: FuzzyDateInt - End date minimum
 * - $endDate_lesser: FuzzyDateInt - End date maximum
 * - $averageScore_greater: Int - Minimum average score
 * - $averageScore_lesser: Int - Maximum average score
 * - $popularity_greater: Int - Minimum popularity
 * - $popularity_lesser: Int - Maximum popularity
 * - $chapters_greater: Int - Minimum chapter count
 * - $chapters_lesser: Int - Maximum chapter count
 * - $volumes_greater: Int - Minimum volume count
 * - $volumes_lesser: Int - Maximum volume count
 * - $genre_in: [String] - Include genres
 * - $genre_not_in: [String] - Exclude genres
 * - $tag_in: [String] - Include tags
 * - $tag_not_in: [String] - Exclude tags
 * - $countryOfOrigin: CountryOfOrigin - Country filter
 * - $isLicensed: Boolean - Licensed content filter
 *
 * Include Variables:
 * - $includeBasic: Boolean - Description, chapters, volumes, isAdult (default: true)
 * - $includeDates: Boolean - Start/end dates, updatedAt
 * - $includeScores: Boolean - Average score, mean score, popularity, favourites
 * - $includeStats: Boolean - Statistics data
 * - $includeMedia: Boolean - Banner image, source, country of origin
 * - $includeRelations: Boolean - Related media
 * - $includeRecommendations: Boolean - Recommendations
 * - $includeCharacters: Boolean - Character data
 * - $includeStaff: Boolean - Staff data
 * - $includeStudios: Boolean - Studio data
 * - $includeExternal: Boolean - External links, isLicensed
 * - $includeTrending: Boolean - Trending value
 * - $includeTags: Boolean - Genres and tags
 * - $includeStreaming: Boolean - Streaming links
 *
 * @example
 * ```typescript
 * const query = buildConditionalAdvancedSearchQuery();
 * const result = await client.query(query, {
 *   search: "action",
 *   genre_in: ["Action", "Adventure"],
 *   averageScore_greater: 70,
 *   includeScores: true,
 *   includeTags: true
 * });
 * ```
 */
export function buildConditionalAdvancedSearchQuery(): string {
  return `
    query ConditionalAdvancedSearch(
      $search: String,
      $page: Int = 1,
      $perPage: Int = 20,
      $sort: [MediaSort],
      $season: MediaSeason,
      $seasonYear: Int,
      $startDate_greater: FuzzyDateInt,
      $startDate_lesser: FuzzyDateInt,
      $endDate_greater: FuzzyDateInt,
      $endDate_lesser: FuzzyDateInt,
      $averageScore_greater: Int,
      $averageScore_lesser: Int,
      $popularity_greater: Int,
      $popularity_lesser: Int,
      $chapters_greater: Int,
      $chapters_lesser: Int,
      $volumes_greater: Int,
      $volumes_lesser: Int,
      $genre_in: [String],
      $genre_not_in: [String],
      $tag_in: [String],
      $tag_not_in: [String],
      $countryOfOrigin: CountryOfOrigin,
      $isLicensed: Boolean,
      $includeBasic: Boolean = true,
      $includeDates: Boolean = false,
      $includeScores: Boolean = false,
      $includeStats: Boolean = false,
      $includeMedia: Boolean = false,
      $includeRelations: Boolean = false,
      $includeRecommendations: Boolean = false,
      $includeCharacters: Boolean = false,
      $includeStaff: Boolean = false,
      $includeStudios: Boolean = false,
      $includeExternal: Boolean = false,
      $includeTrending: Boolean = false,
      $includeTags: Boolean = false,
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
        media(
          search: $search,
          type: MANGA,
          sort: $sort,
          season: $season,
          seasonYear: $seasonYear,
          startDate_greater: $startDate_greater,
          startDate_lesser: $startDate_lesser,
          endDate_greater: $endDate_greater,
          endDate_lesser: $endDate_lesser,
          averageScore_greater: $averageScore_greater,
          averageScore_lesser: $averageScore_lesser,
          popularity_greater: $popularity_greater,
          popularity_lesser: $popularity_lesser,
          chapters_greater: $chapters_greater,
          chapters_lesser: $chapters_lesser,
          volumes_greater: $volumes_greater,
          volumes_lesser: $volumes_lesser,
          genre_in: $genre_in,
          genre_not_in: $genre_not_in,
          tag_in: $tag_in,
          tag_not_in: $tag_not_in,
          countryOfOrigin: $countryOfOrigin,
          isLicensed: $isLicensed
        ) {
          ...ConditionalMediaFields
        }
      }
    }

    fragment ConditionalMediaFields on Media {
      # Core fields always included
      id
      idMal
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
      type
      status

      # Conditionally included fields
      description @include(if: $includeBasic)
      chapters @include(if: $includeBasic)
      volumes @include(if: $includeBasic)
      isAdult @include(if: $includeBasic)

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
      updatedAt @include(if: $includeDates)

      averageScore @include(if: $includeScores)
      meanScore @include(if: $includeScores)
      popularity @include(if: $includeScores)
      favourites @include(if: $includeScores)

      bannerImage @include(if: $includeMedia)
      source @include(if: $includeMedia)
      countryOfOrigin @include(if: $includeMedia)

      trending @include(if: $includeTrending)

      genres @include(if: $includeTags)
      tags @include(if: $includeTags) {
        id
        name
        rank
      }

      relations @include(if: $includeRelations) {
        edges {
          relationType
          node {
            id
            title {
              romaji
            }
            type
            format
          }
        }
      }

      externalLinks @include(if: $includeExternal) {
        url
        site
      }
      isLicensed @include(if: $includeExternal)
    }
  `;
}
