/**
 * Browse Discovery Router
 *
 * Provides AniList-powered discovery procedures for browsing manga
 * beyond the local library: author bibliography, genre/tag search.
 *
 * @module server/trpc/routers/browse-discover
 */

import { z } from 'zod';

import { logger } from '@/utils/logger';

import { publicProcedure } from '../procedures';
import { router } from '../trpc';

const log = logger.child('BrowseDiscoverRouter');

const ANILIST_API = 'https://graphql.anilist.co';

// ============================================================================
// AniList GraphQL Queries (minified to avoid nesting-depth lint)
// ============================================================================

const SEARCH_STAFF = 'query($search:String,$perPage:Int){Page(perPage:$perPage){staff(search:$search,sort:SEARCH_MATCH){id name{full native}image{large}primaryOccupations staffMedia(type:MANGA,sort:POPULARITY_DESC,perPage:25){edges{staffRole node{id title{romaji english}coverImage{large}status format genres averageScore popularity chapters volumes startDate{year}}}}}}}';

const SEARCH_BY_GENRE = 'query($genre:String,$page:Int,$perPage:Int){Page(page:$page,perPage:$perPage){pageInfo{total hasNextPage currentPage}media(type:MANGA,genre:$genre,sort:POPULARITY_DESC,isAdult:false){id title{romaji english}coverImage{large}status format genres averageScore popularity chapters volumes startDate{year}}}}';

const SEARCH_BY_TAG = 'query($tag:String,$page:Int,$perPage:Int){Page(page:$page,perPage:$perPage){pageInfo{total hasNextPage currentPage}media(type:MANGA,tag:$tag,sort:POPULARITY_DESC,isAdult:false){id title{romaji english}coverImage{large}status format genres averageScore popularity chapters volumes startDate{year}}}}';

// ============================================================================
// Types
// ============================================================================

interface ALMedia {
  id: number;
  title: { romaji?: string; english?: string };
  coverImage?: { large?: string };
  status?: string;
  format?: string;
  genres?: string[];
  averageScore?: number;
  popularity?: number;
  chapters?: number;
  volumes?: number;
  startDate?: { year?: number };
}

export interface DiscoverManga {
  anilistId: number;
  title: string;
  cover: string;
  status: string;
  genres: string[];
  averageScore: number | null;
  chapters: number | null;
  volumes: number | null;
  year: number | null;
  popularity: number;
}

interface ALStaff {
  id: number;
  name: { full?: string; native?: string };
  image?: { large?: string };
  primaryOccupations?: string[];
  staffMedia: { edges: Array<{ staffRole: string; node: ALMedia }> };
}

interface ALStaffResponse { Page: { staff: ALStaff[] } }

interface ALPagedMediaResponse {
  Page: {
    pageInfo: { total: number; hasNextPage: boolean; currentPage: number };
    media: ALMedia[];
  };
}

// ============================================================================
// Helpers
// ============================================================================

function transformMedia(m: ALMedia): DiscoverManga {
  return {
    anilistId: m.id,
    title: m.title.english ?? m.title.romaji ?? 'Unknown',
    cover: m.coverImage?.large ?? '/cover-not-found.jpg',
    status: m.status ?? 'UNKNOWN',
    genres: m.genres ?? [],
    averageScore: m.averageScore ?? null,
    chapters: m.chapters ?? null,
    volumes: m.volumes ?? null,
    year: m.startDate?.year ?? null,
    popularity: m.popularity ?? 0,
  };
}

async function queryAniList<T>(query: string, variables: Record<string, unknown>): Promise<T | null> {
  const resp = await fetch(ANILIST_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!resp.ok) {
    log.warn('AniList query failed', { status: resp.status });
    return null;
  }
  const json = (await resp.json()) as { data: T };
  return json.data;
}

function transformStaff(staff: ALStaff, searchName: string): {
  id: number; name: string; nativeName: string | null;
  image: string | null; occupations: string[];
  manga: Array<DiscoverManga & { role: string }>;
} {
  return {
    id: staff.id,
    name: staff.name.full ?? staff.name.native ?? searchName,
    nativeName: staff.name.native ?? null,
    image: staff.image?.large ?? null,
    occupations: staff.primaryOccupations ?? [],
    manga: staff.staffMedia.edges.map(e => ({ ...transformMedia(e.node), role: e.staffRole })),
  };
}

const EMPTY_PAGE = { manga: [], pageInfo: { total: 0, hasNextPage: false, currentPage: 1 } };

// ============================================================================
// Router
// ============================================================================

export const browseDiscoverRouter = router({
  /** Search for an author/artist on AniList and return their manga bibliography. */
  getAuthorBibliography: publicProcedure
    .input(z.object({ name: z.string().min(1) }))
    .query(async ({ input }) => {
      const data = await queryAniList<ALStaffResponse>(SEARCH_STAFF, { search: input.name, perPage: 3 });
      const staff = data?.Page.staff;
      if (!staff?.length) return null;
      const best = staff[0];
      if (!best) return null;
      return transformStaff(best, input.name);
    }),

  /** Search AniList for manga by genre. */
  searchByGenre: publicProcedure
    .input(z.object({
      genre: z.string().min(1),
      page: z.number().min(1).default(1),
      perPage: z.number().min(1).max(50).default(30),
    }))
    .query(async ({ input }) => {
      const data = await queryAniList<ALPagedMediaResponse>(
        SEARCH_BY_GENRE, { genre: input.genre, page: input.page, perPage: input.perPage },
      );
      if (!data) return EMPTY_PAGE;
      return { manga: data.Page.media.map(transformMedia), pageInfo: data.Page.pageInfo };
    }),

  /** Search AniList for manga by tag. */
  searchByTag: publicProcedure
    .input(z.object({
      tag: z.string().min(1),
      page: z.number().min(1).default(1),
      perPage: z.number().min(1).max(50).default(30),
    }))
    .query(async ({ input }) => {
      const data = await queryAniList<ALPagedMediaResponse>(
        SEARCH_BY_TAG, { tag: input.tag, page: input.page, perPage: input.perPage },
      );
      if (!data) return EMPTY_PAGE;
      return { manga: data.Page.media.map(transformMedia), pageInfo: data.Page.pageInfo };
    }),
});
