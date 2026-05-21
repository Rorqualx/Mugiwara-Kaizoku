/**
 * Modular AniList GraphQL Query Collection
 * 
 * This module provides a collection of optimized GraphQL queries for the AniList API.
 * Each query is designed for specific use cases to minimize data transfer and
 * optimize performance.
 * 
 * Query Categories:
 * - Basic Information: Light queries for search results and lists
 * - Detailed Information: Full data for manga detail pages
 * - Related Content: Relationships and recommendations
 * - Staff and Characters: Detailed personnel information
 * - Community Data: User ratings and trends
 * 
 * Performance Considerations:
 * - Queries are modularized to prevent over-fetching
 * - Field selection is optimized for common use cases
 * - Nested data is structured for efficient caching
 * 
 * Rate Limiting:
 * - Basic queries count as 1 request
 * - Detailed queries with relationships count as 2 requests
 * - Staff/character queries may count as multiple requests
 * 
 * @module anilistQueries
 */

/**
 * Basic Manga Information Query
 * 
 * Lightweight query for essential manga details, optimized for:
 * - Search results
 * - List views
 * - Grid displays
 * - Quick lookups
 * 
 * Performance Impact:
 * - Single request
 * - Minimal data transfer
 * - Efficient caching
 * 
 * @example
 * ```typescript
 * const result = await client.query(BASIC_MANGA_INFO, { id: 123 });
 * logger.info(result.Media["title"].english);
 * ```
 */
export const BASIC_MANGA_INFO = `
  query BasicMangaInfo($id: Int) {
    Media(id: $id, type: MANGA) {
      id
      idMal
      title {
        romaji
        english
        native
      }
      format
      status
      description
      coverImage {
        extraLarge
        large
        medium
      }
      volumes
      chapters
      genres
      averageScore
      popularity
    }
  }
`;

/**
 * Detailed Manga Information Query
 * 
 * Comprehensive query for full manga details, used for:
 * - Manga detail pages
 * - Metadata enrichment
 * - Full synchronization
 * 
 * Performance Impact:
 * - Counts as 2 requests due to data volume
 * - Higher bandwidth usage
 * - Longer cache TTL recommended
 * 
 * @example
 * ```typescript
 * const result = await client.query(DETAILED_MANGA_INFO, { id: 123 });
 * const { volumes, chapters, genres } = result.Media;
 * ```
 */
export const DETAILED_MANGA_INFO = `
  query DetailedMangaInfo($id: Int) {
    Media(id: $id, type: MANGA) {
      # Basic fields
      id
      idMal
      title {
        romaji
        english
        native
      }
      format
      status
      description
      
      # Publication details
      volumes
      chapters
      countryOfOrigin
      isLicensed
      source
      
      # Dates
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
      season
      seasonYear
      
      # Media stats
      averageScore
      meanScore
      popularity
      favorites
      
      # Tags and genres
      genres
      synonyms
      tags {
        id
        name
        category
      }
      
      # Images
      coverImage {
        extraLarge
        large
        medium
        color
      }
      bannerImage
    }
  }
`;

/**
 * Related Manga Content Query
 * 
 * Fetches relationships and recommendations, useful for:
 * - "Similar manga" sections
 * - Reading suggestions
 * - Series connections
 * 
 * Performance Impact:
 * - May trigger multiple requests
 * - Results are highly cacheable
 * - Consider pagination for large datasets
 * 
 * @example
 * ```typescript
 * const result = await client.query(RELATED_MANGA_INFO, { id: 123 });
 * const recommendations = result.Media.recommendations.nodes;
 * ```
 */
export const RELATED_MANGA_INFO = `
  query RelatedMangaInfo($id: Int) {
    Media(id: $id, type: MANGA) {
      id
      relations {
        edges {
          relationType
          node {
            id
            title {
              romaji
              english
            }
            format
            type
            status
            coverImage {
              medium
            }
          }
        }
      }
      recommendations {
        nodes {
          mediaRecommendation {
            id
            title {
              romaji
              english
            }
            coverImage {
              medium
            }
          }
        }
      }
    }
  }
`;

/**
 * Staff and Characters Information Query
 * 
 * Detailed personnel and character data, designed for:
 * - Character galleries
 * - Staff credits pages
 * - Detailed attribution sections
 * 
 * Performance Impact:
 * - Heavy query (multiple requests)
 * - Large response size
 * - Consider lazy loading
 * 
 * @example
 * ```typescript
 * const result = await client.query(STAFF_AND_CHARACTERS_INFO, { id: 123 });
 * const characters = result.Media.characters.edges;
 * ```
 */
export const STAFF_AND_CHARACTERS_INFO = `
  query StaffAndCharactersInfo($id: Int) {
    Media(id: $id, type: MANGA) {
      id
      characters {
        edges {
          role
          node {
            id
            name {
              full
              native
            }
            image {
              large
            }
            description
          }
        }
      }
      staff {
        edges {
          role
          node {
            id
            name {
              full
              native
            }
            image {
              large
            }
          }
        }
      }
    }
  }
`;

/**
 * Community Data Information Query
 * 
 * Fetches user-generated content and trends, useful for:
 * - Popularity tracking
 * - Review sections
 * - Trending manga lists
 * 
 * Performance Impact:
 * - Moderate query weight
 * - Data frequently updates
 * - Short cache TTL recommended
 * 
 * @example
 * ```typescript
 * const result = await client.query(COMMUNITY_DATA_INFO, { id: 123 });
 * const reviews = result.Media.reviews.nodes;
 * ```
 */
export const COMMUNITY_DATA_INFO = `
  query CommunityDataInfo($id: Int) {
    Media(id: $id, type: MANGA) {
      id
      trends {
        nodes {
          date
          trending
          popularity
        }
      }
      reviews {
        nodes {
          id
          summary
          score
          user {
            name
          }
        }
      }
    }
  }
`;

/**
 * Basic Manga Search Query
 * 
 * Optimized search query with pagination, designed for:
 * - Search interfaces
 * - Filtered lists
 * - Quick lookups
 * 
 * Performance Impact:
 * - Light query weight
 * - Supports pagination
 * - Efficient for autocomplete
 * 
 * @example
 * ```typescript
 * const result = await client.query(SEARCH_BASIC_MANGA, {
 *   search: "One Piece",
 *   page: 1,
 *   perPage: 10
 * });
 * const manga = result.Page.media;
 * ```
 */
export const SEARCH_BASIC_MANGA = `
  query SearchBasicManga($search: String, $page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      pageInfo {
        total
        currentPage
        lastPage
        hasNextPage
        perPage
      }
      media(type: MANGA, search: $search) {
        id
        idMal
        title {
          romaji
          english
          native
        }
        format
        status
        description
        coverImage {
          extraLarge
          large
          medium
        }
        volumes
        chapters
        genres
        averageScore
        popularity
      }
    }
  }
`;

/**
 * Complete Manga Information Query
 * 
 * Comprehensive query that fetches all available data, used for:
 * - Full manga synchronization
 * - Data exports
 * - Complete metadata updates
 * 
 * Performance Impact:
 * - Heaviest query (multiple requests)
 * - Large response size
 * - Long processing time
 * - Extended cache TTL recommended
 * 
 * Warning: Use sparingly due to high resource usage
 * 
 * @example
 * ```typescript
 * const result = await client.query(COMPLETE_MANGA_INFO, { id: 123 });
 * // Access any available manga data
 * const {
 *   title,
 *   staff,
 *   characters,
 *   recommendations
 * } = result.Media;
 * ```
 */
export const COMPLETE_MANGA_INFO = `
  query CompleteMangaInfo($id: Int) {
    Media(id: $id, type: MANGA) {
      # Basic information
      id
      idMal
      title {
        romaji
        english
        native
      }
      type
      format
      status
      description
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
      season
      seasonYear
      
      # Publication details
      volumes
      chapters
      countryOfOrigin
      isLicensed
      source
      
      # Media stats
      averageScore
      meanScore
      popularity
      favorites
      trending
      
      # Tags and genres
      genres
      synonyms
      tags {
        id
        name
        description
        category
        rank
        isGeneralSpoiler
        isMediaSpoiler
      }
      
      # Images
      coverImage {
        extraLarge
        large
        medium
        color
      }
      bannerImage
      
      # Relations and external links
      relations {
        edges {
          id
          relationType
          node {
            id
            title {
              romaji
              english
            }
            format
            type
            status
            coverImage {
              medium
            }
          }
        }
      }
      externalLinks {
        id
        url
        site
        type
      }
      
      # Staff and production
      staff {
        edges {
          role
          node {
            id
            name {
              full
              native
            }
            image {
              large
            }
          }
        }
      }
      
      # Characters
      characters {
        edges {
          role
          node {
            id
            name {
              full
              native
            }
            image {
              large
            }
            description
          }
        }
      }
      
      # Recommendations
      recommendations {
        nodes {
          mediaRecommendation {
            id
            title {
              romaji
              english
            }
            coverImage {
              medium
            }
          }
        }
      }
      
      # Community data
      trends {
        nodes {
          date
          trending
          popularity
        }
      }
      reviews {
        nodes {
          id
          summary
          score
          user {
            name
          }
        }
      }
    }
  }
`;

/**
 * Build a dynamic search query based on requested fields
 * 
 * @param {string[]} fields - Array of field names to include in the query
 * @returns {string} GraphQL query string
 * 
 * @example
 * ```typescript
 * const query = buildSearchQuery(['title', 'description', 'coverImage']);
 * ```
 */
export function buildSearchQuery(fields: string[]): string {
  const fieldMap: Record<string, string> = {
    title: `
      title {
        romaji
        english
        native
      }
    `,
    description: 'description',
    coverImage: `
      coverImage {
        extraLarge
        large
        medium
        color
      }
    `,
    status: 'status',
    format: 'format',
    chapters: 'chapters',
    volumes: 'volumes',
    genres: 'genres',
    synonyms: 'synonyms',
    averageScore: 'averageScore',
    popularity: 'popularity',
    idMal: 'idMal',
    bannerImage: 'bannerImage',
    startDate: `
      startDate {
        year
        month
        day
      }
    `,
    endDate: `
      endDate {
        year
        month
        day
      }
    `,
    tags: `
      tags {
        id
        name
        category
        rank
      }
    `,
    staff: `
      staff(sort: RELEVANCE, perPage: 10) {
        edges {
          id
          role
          node {
            id
            name {
              full
              native
            }
          }
        }
      }
    `,
    countryOfOrigin: 'countryOfOrigin',
    isAdult: 'isAdult',
    source: 'source',
    externalLinks: `
      externalLinks {
        id
        url
        site
        type
      }
    `
  };

  const selectedFields = fields.
  map((field) => fieldMap[field] ?? '').
  filter(Boolean).
  join('\n');

  return `
    query SearchManga($search: String, $limit: Int, $isAdult: Boolean) {
      Page(page: 1, perPage: $limit) {
        media(type: MANGA, search: $search, isAdult: $isAdult) {
          id
          ${selectedFields}
        }
      }
    }
  `;
}