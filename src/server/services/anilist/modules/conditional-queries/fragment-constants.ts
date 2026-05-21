/**
 * Fragment Constants for AniList Conditional Queries
 *
 * Provides reusable GraphQL field snippets for composing queries.
 * These constants represent individual field groups that can be
 * conditionally included using @include/@skip directives.
 *
 * Split from: fragment-templates.ts (fields and constants portion)
 *
 * @module fragment-constants
 */

// Base Media Fields
// ============================================================================

/**
 * Base media fields that are always included in queries (search/advanced search variant)
 */
export const BASE_MEDIA_FIELDS = `
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
`;

/**
 * Base media fields for details queries (includes extraLarge cover image)
 */
export const BASE_MEDIA_FIELDS_DETAILS = `
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
`;

// Conditional Field Groups - Basic
// ============================================================================

/**
 * Basic conditional fields (description, chapters, volumes, isAdult)
 */
export const BASIC_FIELDS = `
  description @include(if: $includeBasic)
  chapters @include(if: $includeBasic)
  volumes @include(if: $includeBasic)
  isAdult @include(if: $includeBasic)
`;

/**
 * Date conditional fields (startDate, endDate, updatedAt)
 */
export const DATE_FIELDS = `
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
`;

/**
 * Score conditional fields (averageScore, meanScore, popularity, favourites)
 */
export const SCORE_FIELDS = `
  averageScore @include(if: $includeScores)
  meanScore @include(if: $includeScores)
  popularity @include(if: $includeScores)
  favourites @include(if: $includeScores)
`;

/**
 * Media conditional fields (bannerImage, source, countryOfOrigin)
 */
export const MEDIA_FIELDS = `
  bannerImage @include(if: $includeMedia)
  source @include(if: $includeMedia)
  countryOfOrigin @include(if: $includeMedia)
`;

/**
 * Trending conditional field
 */
export const TRENDING_FIELD = `
  trending @include(if: $includeTrending)
`;

// Tags
// ============================================================================

/**
 * Tags conditional fields for search queries (full tag details)
 */
export const TAGS_FIELDS_FULL = `
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
`;

/**
 * Tags conditional fields for advanced search (minimal tag details)
 */
export const TAGS_FIELDS_MINIMAL = `
  genres @include(if: $includeTags)
  tags @include(if: $includeTags) {
    id
    name
    rank
  }
`;

// Relations
// ============================================================================

/**
 * Relations conditional fields for search queries
 */
export const RELATIONS_FIELDS_SEARCH = `
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
`;

/**
 * Relations conditional fields for detail queries (with large cover)
 */
export const RELATIONS_FIELDS_DETAILS = `
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
`;

/**
 * Relations conditional fields for advanced search (minimal)
 */
export const RELATIONS_FIELDS_MINIMAL = `
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
`;

// ============================================================================
// Characters
// ============================================================================

/**
 * Characters conditional fields for search queries
 */
export const CHARACTERS_FIELDS_SEARCH = `
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
`;

/**
 * Characters conditional fields for detail queries (with extra info)
 */
export const CHARACTERS_FIELDS_DETAILS = `
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
`;

// ============================================================================
// Staff
// ============================================================================

/**
 * Staff conditional fields for search queries
 */
export const STAFF_FIELDS_SEARCH = `
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
`;

/**
 * Staff conditional fields for detail queries (with extra info)
 */
export const STAFF_FIELDS_DETAILS = `
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
`;

// ============================================================================
// Studios
// ============================================================================

/**
 * Studios conditional fields for search queries
 */
export const STUDIOS_FIELDS_SEARCH = `
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
`;

/**
 * Studios conditional fields for detail queries (with isAnimationStudio)
 */
export const STUDIOS_FIELDS_DETAILS = `
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
`;

// ============================================================================
// External Links
// ============================================================================

/**
 * External links conditional fields for search queries (full details)
 */
export const EXTERNAL_LINKS_FIELDS_FULL = `
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
`;

/**
 * External links conditional fields for advanced search (minimal)
 */
export const EXTERNAL_LINKS_FIELDS_MINIMAL = `
  externalLinks @include(if: $includeExternal) {
    url
    site
  }
  isLicensed @include(if: $includeExternal)
`;

// ============================================================================
// Streaming
// ============================================================================

/**
 * Streaming episodes conditional fields
 */
export const STREAMING_FIELDS = `
  streamingEpisodes @include(if: $includeStreaming) {
    title
    thumbnail
    url
    site
  }
`;

// ============================================================================
// Recommendations
// ============================================================================

/**
 * Recommendations conditional fields for search queries
 */
export const RECOMMENDATIONS_FIELDS_SEARCH = `
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
`;

/**
 * Recommendations conditional fields for detail queries (with extra info)
 */
export const RECOMMENDATIONS_FIELDS_DETAILS = `
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
`;

// ============================================================================
// Stats
// ============================================================================

/**
 * Stats conditional fields (scoreDistribution, statusDistribution, rankings)
 */
export const STATS_FIELDS = `
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
`;
