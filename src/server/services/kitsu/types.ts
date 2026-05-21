/**
 * Kitsu API types — JSON:API responses from kitsu.io/api/edges/manga.
 * Public, unauthenticated; rate limit ~10 req/s.
 */

export interface KitsuPosterImage {
  tiny?: string;
  small?: string;
  medium?: string;
  large?: string;
  original?: string;
}

export interface KitsuCoverImage {
  tiny?: string;
  small?: string;
  large?: string;
  original?: string;
}

export interface KitsuTitles {
  en?: string;
  en_jp?: string;
  ja_jp?: string;
  [key: string]: string | undefined;
}

export interface KitsuMangaAttributes {
  slug: string;
  synopsis: string | null;
  description: string | null;
  canonicalTitle: string;
  titles: KitsuTitles;
  abbreviatedTitles: string[] | null;
  startDate: string | null;
  endDate: string | null;
  ageRating: string | null;
  ageRatingGuide: string | null;
  subtype: string;
  status: string;
  posterImage: KitsuPosterImage | null;
  coverImage: KitsuCoverImage | null;
  chapterCount: number | null;
  volumeCount: number | null;
  serialization: string | null;
  averageRating: string | null;
  userCount: number;
  favoritesCount: number;
  popularityRank: number | null;
  ratingRank: number | null;
}

export interface KitsuManga {
  id: string;
  type: 'manga';
  attributes: KitsuMangaAttributes;
}

export interface KitsuSearchResponse {
  data: KitsuManga[];
  meta?: { count?: number };
  links?: { first?: string; next?: string; last?: string };
}

export interface KitsuDetailsResponse {
  data: KitsuManga;
}
