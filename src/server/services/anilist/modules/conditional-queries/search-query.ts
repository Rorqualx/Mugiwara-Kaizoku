/**
 * Conditional Search Query for AniList API
 *
 * Builds a paginated search query with @include/@skip directives
 * for optimal performance and flexible field selection.
 *
 * Extracted from: conditionalQueries.ts (lines 13-247)
 */

/**
 * Build search query with conditional fields
 *
 * @returns GraphQL query string with all conditional field variables
 *
 * Variables:
 * - $search: String - Search term
 * - $page: Int - Page number (default: 1)
 * - $perPage: Int - Results per page (default: 20)
 * - $sort: [MediaSort] - Sort order
 * - $includeBasic: Boolean - Include description, chapters, volumes, isAdult
 * - $includeDates: Boolean - Include startDate, endDate, updatedAt
 * - $includeScores: Boolean - Include averageScore, meanScore, popularity, favourites
 * - $includeStats: Boolean - Include stats and rankings
 * - $includeMedia: Boolean - Include bannerImage, source, countryOfOrigin
 * - $includeRelations: Boolean - Include related media
 * - $includeRecommendations: Boolean - Include recommendations
 * - $includeCharacters: Boolean - Include character data
 * - $includeStaff: Boolean - Include staff data
 * - $includeStudios: Boolean - Include studio data
 * - $includeExternal: Boolean - Include external links
 * - $includeTrending: Boolean - Include trending score
 * - $includeTags: Boolean - Include genres and tags
 * - $includeStreaming: Boolean - Include streaming episodes
 *
 * @example
 * ```typescript
 * const query = buildConditionalSearchQuery();
 * const result = await client.query(query, {
 *   search: "One Piece",
 *   page: 1,
 *   perPage: 20,
 *   includeBasic: true,
 *   includeScores: true,
 *   includeDates: false,
 *   includeStats: false,
 *   includeMedia: false,
 *   includeRelations: false,
 *   includeRecommendations: false,
 *   includeCharacters: false,
 *   includeStaff: false,
 *   includeStudios: false,
 *   includeExternal: false,
 *   includeTrending: false,
 *   includeTags: false,
 *   includeStreaming: false
 * });
 * ```
 */
export function buildConditionalSearchQuery(): string {
  return `
    query ConditionalSearch(
      $search: String,
      $page: Int = 1,
      $perPage: Int = 20,
      $sort: [MediaSort],
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
        media(search: $search, type: MANGA, sort: $sort) {
          ...ConditionalMediaFields
        }
      }
    }

    fragment ConditionalMediaFields on Media {
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

      # Basic fields
      description @include(if: $includeBasic)
      chapters @include(if: $includeBasic)
      volumes @include(if: $includeBasic)
      isAdult @include(if: $includeBasic)

      # Date fields
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

      # Score fields
      averageScore @include(if: $includeScores)
      meanScore @include(if: $includeScores)
      popularity @include(if: $includeScores)
      favourites @include(if: $includeScores)

      # Media fields
      bannerImage @include(if: $includeMedia)
      source @include(if: $includeMedia)
      countryOfOrigin @include(if: $includeMedia)

      # Trending
      trending @include(if: $includeTrending)

      # Tags
      genres @include(if: $includeTags)
      tags @include(if: $includeTags) {
        id
        name
        description
        category
        rank
        isGeneralSpoiler
        isMediaSpoiler
        isAdult
      }

      # Relations
      relations @include(if: $includeRelations) {
        edges {
          id
          relationType
          node {
            id
            title {
              romaji
              english
            }
            type
            format
            status
            coverImage {
              medium
            }
          }
        }
      }

      # Characters
      characters @include(if: $includeCharacters) {
        edges {
          id
          role
          node {
            id
            name {
              full
              native
            }
            image {
              large
              medium
            }
          }
        }
      }

      # Staff
      staff @include(if: $includeStaff) {
        edges {
          id
          role
          node {
            id
            name {
              full
              native
            }
            image {
              large
              medium
            }
          }
        }
      }

      # Studios
      studios @include(if: $includeStudios) {
        edges {
          id
          isMain
          node {
            id
            name
          }
        }
      }

      # External links
      externalLinks @include(if: $includeExternal) {
        id
        url
        site
        type
        language
        color
        icon
      }
      isLicensed @include(if: $includeExternal)

      # Streaming
      streamingEpisodes @include(if: $includeStreaming) {
        title
        thumbnail
        url
        site
      }

      # Recommendations
      recommendations @include(if: $includeRecommendations) {
        edges {
          node {
            id
            rating
            mediaRecommendation {
              id
              title {
                romaji
                english
              }
              coverImage {
                large
              }
              averageScore
              popularity
            }
          }
        }
      }

      # Stats
      stats @include(if: $includeStats) {
        scoreDistribution {
          score
          amount
        }
        statusDistribution {
          status
          amount
        }
      }
      rankings @include(if: $includeStats) {
        id
        rank
        type
        format
        year
        season
        allTime
        context
      }
    }
  `;
}
