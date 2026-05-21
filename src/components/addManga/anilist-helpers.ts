/**
 * AniList search result types and conversion helpers for AddMangaModal.
 *
 * @module components/addManga/anilist-helpers
 */

import type { ExtendedMangaSearchResult } from '@/types/search.types';

/** Shape of a single AniList search result from the searchManga mutation */
export type AniListSearchResult = {
  id: number;
  idMal: number | null;
  title: { romaji: string | null; english: string | null; native: string | null };
  description: string | null;
  coverImage: { extraLarge: string | null; large: string | null; medium: string | null; color: string | null };
  bannerImage: string | null;
  format: string | null;
  status: string | null;
  volumes: number | null;
  chapters: number | null;
  genres: string[];
  averageScore: number | null;
  popularity: number | null;
  startDate: { year?: number | null; month?: number | null; day?: number | null } | null;
};

/** Common subset of AniList data for conversion to ExtendedMangaSearchResult */
interface AniListConvertible {
  id: number;
  title: { english?: string | null; romaji?: string | null; native?: string | null };
  coverImage?: { large?: string | null; medium?: string | null } | null;
  description?: string | null;
  genres?: string[];
  status?: string | null;
  volumes?: number | null;
  chapters?: number | null;
  averageScore?: number | null;
  popularity?: number | null;
  bannerImage?: string | null;
  format?: string | null;
}

/** Convert AniList data (search result or detail) to ExtendedMangaSearchResult */
export function anilistToExtended(data: AniListConvertible): ExtendedMangaSearchResult {
  const cover = data.coverImage?.large ?? data.coverImage?.medium ?? undefined;
  return {
    id: data.id,
    title: data.title.english ?? data.title.romaji ?? data.title.native ?? 'Unknown',
    coverImage: cover, cover,
    provider: 'anilist', source: 'anilist', anilistId: data.id,
    description: data.description ?? undefined,
    genres: data.genres ?? [],
    status: data.status ?? undefined,
    volumes: data.volumes ?? undefined,
    chapters: data.chapters ?? undefined,
    averageScore: data.averageScore ?? undefined,
    popularity: data.popularity ?? undefined,
    bannerImage: data.bannerImage ?? undefined,
    format: data.format ?? undefined,
  } as ExtendedMangaSearchResult;
}
