/**
 * Fragment Builders for AniList Conditional Queries
 *
 * Provides functions that compose fragment constants into complete
 * GraphQL fragments for different query types.
 *
 * Split from: fragment-templates.ts (builder functions portion)
 *
 * @module fragment-builders
 */

import {
  BASE_MEDIA_FIELDS,
  BASE_MEDIA_FIELDS_DETAILS,
  BASIC_FIELDS,
  DATE_FIELDS,
  SCORE_FIELDS,
  MEDIA_FIELDS,
  TRENDING_FIELD,
  TAGS_FIELDS_FULL,
  TAGS_FIELDS_MINIMAL,
  RELATIONS_FIELDS_SEARCH,
  RELATIONS_FIELDS_DETAILS,
  RELATIONS_FIELDS_MINIMAL,
  CHARACTERS_FIELDS_SEARCH,
  CHARACTERS_FIELDS_DETAILS,
  STAFF_FIELDS_SEARCH,
  STAFF_FIELDS_DETAILS,
  STUDIOS_FIELDS_SEARCH,
  STUDIOS_FIELDS_DETAILS,
  EXTERNAL_LINKS_FIELDS_FULL,
  EXTERNAL_LINKS_FIELDS_MINIMAL,
  STREAMING_FIELDS,
  RECOMMENDATIONS_FIELDS_SEARCH,
  RECOMMENDATIONS_FIELDS_DETAILS,
  STATS_FIELDS,
} from './fragment-constants';

/**
 * Build the ConditionalMediaFields fragment for search queries
 * Includes all conditional field directives
 *
 * @returns GraphQL fragment string for search queries
 */
export function buildSearchMediaFragment(): string {
  return `
    fragment ConditionalMediaFields on Media {
      ${BASE_MEDIA_FIELDS}

      # Basic fields
      ${BASIC_FIELDS}

      # Date fields
      ${DATE_FIELDS}

      # Score fields
      ${SCORE_FIELDS}

      # Media fields
      ${MEDIA_FIELDS}

      # Trending
      ${TRENDING_FIELD}

      # Tags
      ${TAGS_FIELDS_FULL}

      # Relations
      ${RELATIONS_FIELDS_SEARCH}

      # Characters
      ${CHARACTERS_FIELDS_SEARCH}

      # Staff
      ${STAFF_FIELDS_SEARCH}

      # Studios
      ${STUDIOS_FIELDS_SEARCH}

      # External links
      ${EXTERNAL_LINKS_FIELDS_FULL}

      # Streaming
      ${STREAMING_FIELDS}

      # Recommendations
      ${RECOMMENDATIONS_FIELDS_SEARCH}

      # Stats
      ${STATS_FIELDS}
    }
  `;
}

/**
 * Build the ConditionalMediaFields fragment for detail queries
 * Has slightly different fields (extraLarge cover, more character/staff details)
 *
 * @returns GraphQL fragment string for detail queries
 */
export function buildDetailsMediaFragment(): string {
  return `
    fragment ConditionalMediaFields on Media {
      # Same fields as search query
      ${BASE_MEDIA_FIELDS_DETAILS}

      ${BASIC_FIELDS}

      ${DATE_FIELDS}

      ${SCORE_FIELDS}

      ${MEDIA_FIELDS}

      ${TRENDING_FIELD}

      ${TAGS_FIELDS_FULL}

      ${RELATIONS_FIELDS_DETAILS}

      ${CHARACTERS_FIELDS_DETAILS}

      ${STAFF_FIELDS_DETAILS}

      ${STUDIOS_FIELDS_DETAILS}

      ${EXTERNAL_LINKS_FIELDS_FULL}

      ${STREAMING_FIELDS}

      ${RECOMMENDATIONS_FIELDS_DETAILS}

      ${STATS_FIELDS}
    }
  `;
}

/**
 * Build a simplified ConditionalMediaFields fragment for advanced search
 *
 * @returns GraphQL fragment string for advanced search queries
 */
export function buildAdvancedSearchMediaFragment(): string {
  return `
    fragment ConditionalMediaFields on Media {
      # Core fields always included
      ${BASE_MEDIA_FIELDS}

      # Conditionally included fields
      ${BASIC_FIELDS}

      ${DATE_FIELDS}

      ${SCORE_FIELDS}

      ${MEDIA_FIELDS}

      ${TRENDING_FIELD}

      ${TAGS_FIELDS_MINIMAL}

      ${RELATIONS_FIELDS_MINIMAL}

      ${EXTERNAL_LINKS_FIELDS_MINIMAL}
    }
  `;
}
