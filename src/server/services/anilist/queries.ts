/**
 * AniList GraphQL Query Collection
 * 
 * A comprehensive collection of GraphQL queries for interacting with the AniList API.
 * Each query is optimized for specific manga-related operations and includes
 * field selections based on application requirements.
 * 
 * Query Categories:
 * - Search and Discovery
 * - Detailed Information
 * - User Lists
 * - Trending and Popular
 * - Genre and Tag Based
 * - Status and Year Filters
 * 
 * @module server/services/anilist/queries
 */

/**
 * Search Manga Query
 * 
 * Searches for manga by title with pagination support.
 * Returns comprehensive manga information including titles,
 * cover images, and metadata.
 * 
 * Parameters:
 * @param {string} search - Search query string
 * @param {number} page - Page number for pagination
 * @param {number} perPage - Results per page
 * 
 * @example
 * ```typescript
 * const response = await client.query(SEARCH_MANGA, {
 *   search: "One Piece",
 *   page: 1,
 *   perPage: 10
 * });
 * ```
 */
export const SEARCH_MANGA = `
  query ($search: String, $page: Int, $perPage: Int, $isAdult: Boolean) {
    Page(page: $page, perPage: $perPage) {
      pageInfo {
        total
        currentPage
        lastPage
        hasNextPage
        perPage
      }
      media(type: MANGA, search: $search, isAdult: $isAdult) {
        id
        idMal
        title {
          romaji
          english
          native
        }
        description
        coverImage {
          extraLarge
          large
          medium
          color
        }
        bannerImage
        format
        status
        countryOfOrigin
        isAdult
        volumes
        chapters
        genres
        synonyms
        averageScore
        meanScore
        popularity
        siteUrl
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
        tags {
          id
          name
          category
          rank
          isMediaSpoiler
        }
      }
    }
  }
`;

/**
 * Detailed Manga Information Query
 * 
 * Retrieves comprehensive information about a specific manga.
 * Includes extended details like characters, staff, relations,
 * and recommendations.
 * 
 * Parameters:
 * @param {number} id - AniList manga ID
 * 
 * @example
 * ```typescript
 * const response = await client.query(GET_MANGA_DETAILS, {
 *   id: 30013 // One Piece
 * });
 * ```
 */
export const GET_MANGA_DETAILS = `
  query ($id: Int) {
    Media(id: $id, type: MANGA) {
      id
      idMal
      title {
        romaji
        english
        native
      }
      description
      coverImage {
        extraLarge
        large
        medium
        color
      }
      bannerImage
      format
      status
      countryOfOrigin
      isAdult
      volumes
      chapters
      genres
      synonyms
      averageScore
      meanScore
      popularity
      siteUrl
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
      tags {
        id
        name
        category
        rank
        isMediaSpoiler
      }
      characters(sort: ROLE, page: 1, perPage: 10) {
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
              medium
            }
            description
            gender
            age
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
              medium
            }
            description
            primaryOccupations
          }
        }
      }
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
 * User's Manga List Query
 * 
 * Retrieves a user's manga list including reading status,
 * progress, and ratings.
 * 
 * Parameters:
 * @param {string} userName - AniList username
 * 
 * @example
 * ```typescript
 * const response = await client.query(GET_USER_MANGA_LIST, {
 *   userName: "example_user"
 * });
 * ```
 */
export const GET_USER_MANGA_LIST = `
  query ($userName: String) {
    MediaListCollection(userName: $userName, type: MANGA) {
      lists {
        name
        status
        entries {
          id
          media {
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
            status
            chapters
            volumes
          }
          status
          progress
          progressVolumes
          score
          startedAt {
            year
            month
            day
          }
          completedAt {
            year
            month
            day
          }
          notes
        }
      }
    }
  }
`;

/**
 * Trending Manga Query
 * 
 * Retrieves currently trending manga with pagination support.
 * Sorted by trending score in descending order.
 * 
 * Parameters:
 * @param {number} page - Page number
 * @param {number} perPage - Results per page
 * 
 * @example
 * ```typescript
 * const response = await client.query(GET_TRENDING_MANGA, {
 *   page: 1,
 *   perPage: 20
 * });
 * ```
 */
export const GET_TRENDING_MANGA = `
  query ($page: Int, $perPage: Int, $isAdult: Boolean) {
    Page(page: $page, perPage: $perPage) {
      pageInfo {
        total
        currentPage
        lastPage
        hasNextPage
      }
      media(type: MANGA, sort: TRENDING_DESC, isAdult: $isAdult) {
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
        bannerImage
        status
        chapters
        genres
        averageScore
        popularity
        staff(perPage: 5, sort: RELEVANCE) {
          edges {
            role
            node {
              name {
                full
              }
            }
          }
        }
      }
    }
  }
`;

/**
 * Popular Manga Query
 * 
 * Retrieves most popular manga with pagination support.
 * Sorted by popularity in descending order.
 * 
 * Parameters:
 * @param {number} page - Page number
 * @param {number} perPage - Results per page
 * 
 * @example
 * ```typescript
 * const response = await client.query(GET_POPULAR_MANGA, {
 *   page: 1,
 *   perPage: 20
 * });
 * ```
 */
export const GET_POPULAR_MANGA = `
  query ($page: Int, $perPage: Int, $isAdult: Boolean) {
    Page(page: $page, perPage: $perPage) {
      pageInfo {
        total
        currentPage
        lastPage
        hasNextPage
      }
      media(type: MANGA, sort: POPULARITY_DESC, isAdult: $isAdult) {
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
        status
        genres
        averageScore
        popularity
        staff(perPage: 5, sort: RELEVANCE) {
          edges {
            role
            node {
              name {
                full
              }
            }
          }
        }
      }
    }
  }
`;

/**
 * Top Rated Manga Query
 *
 * Retrieves highest-rated manga sorted by average score.
 * Results are sorted by score in descending order.
 *
 * Parameters:
 * @param {number} page - Page number
 * @param {number} perPage - Results per page
 *
 * @example
 * ```typescript
 * const response = await client.query(GET_TOP_RATED_MANGA, {
 *   page: 1,
 *   perPage: 100
 * });
 * ```
 */
export const GET_TOP_RATED_MANGA = `
  query ($page: Int, $perPage: Int, $isAdult: Boolean) {
    Page(page: $page, perPage: $perPage) {
      pageInfo {
        total
        currentPage
        lastPage
        hasNextPage
      }
      media(type: MANGA, sort: SCORE_DESC, isAdult: $isAdult) {
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
        status
        genres
        averageScore
        popularity
        staff(perPage: 5, sort: RELEVANCE) {
          edges {
            role
            node {
              name {
                full
              }
            }
          }
        }
      }
    }
  }
`;

/**
 * Genre-based Manga Query
 *
 * Retrieves manga filtered by specific genre.
 * Results are sorted by popularity.
 *
 * Parameters:
 * @param {string} genre - Genre to filter by
 * @param {number} page - Page number
 * @param {number} perPage - Results per page
 * 
 * @example
 * ```typescript
 * const response = await client.query(GET_MANGA_BY_GENRE, {
 *   genre: "Action",
 *   page: 1,
 *   perPage: 20
 * });
 * ```
 */
export const GET_MANGA_BY_GENRE = `
  query ($genre: String, $page: Int, $perPage: Int, $isAdult: Boolean) {
    Page(page: $page, perPage: $perPage) {
      pageInfo {
        total
        currentPage
        lastPage
        hasNextPage
      }
      media(type: MANGA, genre: $genre, sort: POPULARITY_DESC, isAdult: $isAdult) {
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
        status
        genres
        averageScore
        popularity
        staff(perPage: 5, sort: RELEVANCE) {
          edges {
            role
            node {
              name {
                full
              }
            }
          }
        }
      }
    }
  }
`;

/**
 * Tag-based Manga Query
 * 
 * Retrieves manga filtered by specific tag.
 * Results are sorted by popularity.
 * 
 * Parameters:
 * @param {string} tag - Tag to filter by
 * @param {number} page - Page number
 * @param {number} perPage - Results per page
 * 
 * @example
 * ```typescript
 * const response = await client.query(GET_MANGA_BY_TAG, {
 *   tag: "Time Travel",
 *   page: 1,
 *   perPage: 20
 * });
 * ```
 */
export const GET_MANGA_BY_TAG = `
  query ($tag: String, $page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      pageInfo {
        total
        currentPage
        lastPage
        hasNextPage
      }
      media(type: MANGA, tag: $tag, sort: POPULARITY_DESC) {
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
        status
        genres
        averageScore
        popularity
      }
    }
  }
`;

/**
 * Status-based Manga Query
 * 
 * Retrieves manga filtered by publication status.
 * Results are sorted by popularity.
 * 
 * Parameters:
 * @param {MediaStatus} status - Publication status (FINISHED, RELEASING, etc.)
 * @param {number} page - Page number
 * @param {number} perPage - Results per page
 * 
 * @example
 * ```typescript
 * const response = await client.query(GET_MANGA_BY_STATUS, {
 *   status: "RELEASING",
 *   page: 1,
 *   perPage: 20
 * });
 * ```
 */
export const GET_MANGA_BY_STATUS = `
  query ($status: MediaStatus, $page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      pageInfo {
        total
        currentPage
        lastPage
        hasNextPage
      }
      media(type: MANGA, status: $status, sort: POPULARITY_DESC) {
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
        status
        genres
        averageScore
        popularity
      }
    }
  }
`;

/**
 * Year-based Manga Query
 *
 * Retrieves manga that started in a specific year.
 * Results are sorted by popularity.
 *
 * Parameters:
 * @param {number} year - Start year to filter by (uses seasonYear for accurate filtering)
 * @param {number} page - Page number
 * @param {number} perPage - Results per page
 *
 * @example
 * ```typescript
 * const response = await client.query(GET_MANGA_BY_YEAR, {
 *   year: 2020,
 *   page: 1,
 *   perPage: 20
 * });
 * ```
 */
export const GET_MANGA_BY_YEAR = `
  query ($year: Int, $page: Int, $perPage: Int, $isAdult: Boolean) {
    Page(page: $page, perPage: $perPage) {
      pageInfo {
        total
        currentPage
        lastPage
        hasNextPage
      }
      media(type: MANGA, seasonYear: $year, sort: POPULARITY_DESC, isAdult: $isAdult) {
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
        status
        genres
        averageScore
        popularity
        startDate {
          year
        }
      }
    }
  }
`;

/**
 * Format-based Manga Query
 *
 * Retrieves manga filtered by specific format (NOVEL, ONE_SHOT, etc.).
 * Results are sorted by popularity.
 *
 * Parameters:
 * @param {MediaFormat} format - Format to filter by (NOVEL, ONE_SHOT, MANGA)
 * @param {number} page - Page number
 * @param {number} perPage - Results per page
 *
 * @example
 * ```typescript
 * const response = await client.query(GET_MANGA_BY_FORMAT, {
 *   format: "NOVEL",
 *   page: 1,
 *   perPage: 20
 * });
 * ```
 */
export const GET_MANGA_BY_FORMAT = `
  query ($format: MediaFormat, $page: Int, $perPage: Int, $isAdult: Boolean) {
    Page(page: $page, perPage: $perPage) {
      pageInfo {
        total
        currentPage
        lastPage
        hasNextPage
      }
      media(type: MANGA, format: $format, sort: POPULARITY_DESC, isAdult: $isAdult) {
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
        bannerImage
        status
        chapters
        genres
        averageScore
        popularity
        staff(perPage: 5, sort: RELEVANCE) {
          edges {
            role
            node {
              name {
                full
              }
            }
          }
        }
      }
    }
  }
`;
