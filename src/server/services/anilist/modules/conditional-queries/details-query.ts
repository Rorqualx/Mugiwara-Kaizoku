/**
 * Conditional Details Query for AniList API
 *
 * Builds a single-media details query with @include/@skip directives
 * for comprehensive manga information on detail pages.
 *
 * Key differences from search query:
 * - Uses `Media(id: $id)` instead of `Page(...)`
 * - Includes `extraLarge` cover image
 * - Has more detailed character/staff fields (description, gender, age, primaryOccupations)
 * - Includes `isAnimationStudio` for studios
 * - Has `pageInfo` in recommendations
 *
 * Extracted from: conditionalQueries.ts (lines 248-476)
 */

/**
 * Build details query with conditional fields
 *
 * @returns GraphQL query string for single manga details
 *
 * Variables:
 * - $id: Int! - AniList media ID (required)
 * - $includeBasic: Boolean = true - description, chapters, volumes, isAdult
 * - $includeDates: Boolean = true - startDate, endDate, updatedAt
 * - $includeScores: Boolean = true - averageScore, meanScore, popularity, favourites
 * - $includeStats: Boolean = false - scoreDistribution, statusDistribution, rankings
 * - $includeMedia: Boolean = true - bannerImage, source, countryOfOrigin
 * - $includeRelations: Boolean = true - related media edges
 * - $includeRecommendations: Boolean = false - recommended media with ratings
 * - $includeCharacters: Boolean = false - character edges with details
 * - $includeStaff: Boolean = false - staff edges with occupations
 * - $includeStudios: Boolean = true - studio edges with animation flag
 * - $includeExternal: Boolean = true - external links and licensing
 * - $includeTrending: Boolean = false - trending score
 * - $includeTags: Boolean = true - genres and tags with metadata
 * - $includeStreaming: Boolean = false - streaming episode links
 *
 * Default Inclusions:
 * - Basic: true
 * - Dates: true
 * - Scores: true
 * - Media: true
 * - Relations: true
 * - Studios: true
 * - External: true
 * - Tags: true
 *
 * @example
 * ```typescript
 * const query = buildConditionalDetailsQuery();
 * const result = await client.query(query, {
 *   id: 123,
 *   includeCharacters: true,
 *   includeStaff: true,
 *   includeRecommendations: true
 * });
 * ```
 */
export function buildConditionalDetailsQuery(): string {
  return `
    query ConditionalDetails(
      $id: Int!,
      $includeBasic: Boolean = true,
      $includeDates: Boolean = true,
      $includeScores: Boolean = true,
      $includeStats: Boolean = false,
      $includeMedia: Boolean = true,
      $includeRelations: Boolean = true,
      $includeRecommendations: Boolean = false,
      $includeCharacters: Boolean = false,
      $includeStaff: Boolean = false,
      $includeStudios: Boolean = true,
      $includeExternal: Boolean = true,
      $includeTrending: Boolean = false,
      $includeTags: Boolean = true,
      $includeStreaming: Boolean = false
    ) {
      Media(id: $id, type: MANGA) {
        ...ConditionalMediaFields
      }
    }

    fragment ConditionalMediaFields on Media {
      # Core fields (always included)
      id
      idMal
      title {
        romaji
        english
        native
      }
      coverImage {
        extraLarge
        large
        medium
      }
      format
      type
      status

      # Basic information
      description @include(if: $includeBasic)
      chapters @include(if: $includeBasic)
      volumes @include(if: $includeBasic)
      isAdult @include(if: $includeBasic)

      # Date information
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

      # Score and popularity metrics
      averageScore @include(if: $includeScores)
      meanScore @include(if: $includeScores)
      popularity @include(if: $includeScores)
      favourites @include(if: $includeScores)

      # Media details
      bannerImage @include(if: $includeMedia)
      source @include(if: $includeMedia)
      countryOfOrigin @include(if: $includeMedia)

      # Trending score
      trending @include(if: $includeTrending)

      # Genres and tags
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

      # Related media
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
              large
            }
          }
        }
      }

      # Characters (detailed)
      characters @include(if: $includeCharacters) {
        pageInfo {
          total
        }
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
            description
            gender
            age
          }
        }
      }

      # Staff (detailed with occupations)
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
            description
            primaryOccupations
          }
        }
      }

      # Studios (with animation flag)
      studios @include(if: $includeStudios) {
        edges {
          id
          isMain
          node {
            id
            name
            isAnimationStudio
          }
        }
      }

      # External links and licensing
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

      # Streaming episodes
      streamingEpisodes @include(if: $includeStreaming) {
        title
        thumbnail
        url
        site
      }

      # Recommendations (with pageInfo)
      recommendations @include(if: $includeRecommendations) {
        pageInfo {
          total
        }
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
              chapters
              volumes
              status
            }
          }
        }
      }

      # Statistics and rankings
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
