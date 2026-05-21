"use strict";
/**
 * AniList GraphQL query strings
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET_MANGA_DETAILS = exports.SEARCH_MANGA = void 0;
/** Search for manga with core fields */
exports.SEARCH_MANGA = `
query ($search: String, $page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    pageInfo {
      total
      currentPage
      lastPage
      hasNextPage
    }
    media(search: $search, type: MANGA, sort: SEARCH_MATCH) {
      id
      idMal
      title {
        romaji
        english
        native
      }
      synonyms
      description(asHtml: false)
      format
      status
      startDate { year month day }
      chapters
      volumes
      coverImage {
        extraLarge
        large
        medium
        color
      }
      bannerImage
      averageScore
      popularity
      countryOfOrigin
      isAdult
      genres
    }
  }
}
`;
/** Get comprehensive manga details */
exports.GET_MANGA_DETAILS = `
query ($id: Int) {
  Media(id: $id, type: MANGA) {
    id
    idMal
    title {
      romaji
      english
      native
    }
    synonyms
    description(asHtml: false)
    format
    status
    startDate { year month day }
    endDate { year month day }
    chapters
    volumes
    countryOfOrigin
    isAdult
    genres
    tags {
      id
      name
      category
      rank
      isMediaSpoiler
      isGeneralSpoiler
    }
    averageScore
    meanScore
    popularity
    trending
    favourites
    coverImage {
      extraLarge
      large
      medium
      color
    }
    bannerImage
    staff(sort: RELEVANCE, perPage: 25) {
      edges {
        role
        node {
          id
          name { full native }
          image { large medium }
          primaryOccupations
        }
      }
    }
    characters(sort: ROLE, perPage: 25) {
      edges {
        role
        node {
          id
          name { full native }
          image { large medium }
          description(asHtml: false)
          gender
          age
        }
      }
    }
    relations {
      edges {
        relationType
        node {
          id
          title { romaji english native }
          format
          status
          coverImage { large medium }
        }
      }
    }
    recommendations(sort: RATING_DESC, perPage: 10) {
      nodes {
        rating
        mediaRecommendation {
          id
          title { romaji english native }
          coverImage { large medium }
        }
      }
    }
    externalLinks {
      url
      site
      type
      language
      color
      icon
    }
    siteUrl
  }
}
`;
//# sourceMappingURL=queries.js.map