/**
 * MangaDex Direct Fetch
 *
 * Moved out of `phase-provider-fetch.ts` together with the manual-pin and
 * rejection handling. Three entry paths:
 *   - manual pin → fetch that manga by UUID, no matcher;
 *   - title search → `pickBestMangaDexMatch` over non-rejected candidates;
 *   - second-wave verify → re-pick with the AniList cross-reference (links.al),
 *     which never replaces a manually pinned entity.
 */

import type { AniListMangaDetails } from '@/server/services/anilist/service';
import { getTsMangadexClient } from '@/server/services/mangadex/ts-client-factory';
import type { MangaDexManga } from '@/server/services/mangadex/types';
import { logger } from '@/utils/logger';

import { extractMangaDexLinks } from './external-id-extractor';
import { fetchMangaDexAggregate } from './mangadex-aggregate';
import { fetchMangaDexChapters } from './mangadex-chapter-list';
import { pickBestMangaDexMatch, pickBestMangaDexMatchWithScore } from './mangadex-matcher';
import { dropRejected, mayBindAfterRejection, type ProviderDirective } from './provider-pins';

import type { ChapterDataItem, UnifiedProviderResults } from '../types';

const log = logger.child('PhaseProviderFetch');

type MangaDexClient = Awaited<ReturnType<typeof getTsMangadexClient>>;

/**
 * MangaDex metadata result — status, lastVolume, lastChapter, plus aggregate.
 * Aggregate provides definitive volume→chapter mapping for cross-validation.
 */
export interface MangaDexDirectResult {
  mangaId: string;
  status: string;
  lastVolume: string | undefined;
  lastChapter: string | undefined;
  aggregate: UnifiedProviderResults['mangadexAggregate'];
  chapterList: ChapterDataItem[];
  malId: number | undefined;
  /** Phase 3 #2: matcher score for the picked entity; used by validateBindingFreshness. */
  matchScore?: number;
  /** True when this entity was fetched by the user's manual pin, not picked by the matcher. */
  manualPin?: boolean;
  /**
   * Manga-level description from MangaDex, localized when possible.
   * Used as a fallback when AniList returns an empty description
   * (iter-27: many obscure JP titles have no AL description but do have MD).
   */
  description: string | undefined;
  /** All non-empty entries from MangaDex attributes.links — al, mu, ap, kt, bw, amz, ebj, etc. */
  externalIds: Record<string, string>;
  /** Phase 1: MangaDex contentRating ('safe'/'suggestive'/'erotica'/'pornographic'). */
  contentRating: string | undefined;
  /** Phase 1: publicationDemographic ('shounen'/'shoujo'/'josei'/'seinen'). */
  publicationDemographic: string | undefined;
}

/** Pick the best-localized MangaDex description. English first, then JP-romaji, then any other. */
function pickMangaDexDescription(desc: Record<string, string> | null | undefined): string | undefined {
  if (!desc || typeof desc !== 'object') return undefined;
  const en = desc['en'];
  if (en && en.trim().length > 0) return en.trim();
  const ja = desc['ja-ro'] ?? desc['ja'];
  if (ja && ja.trim().length > 0) return ja.trim();
  for (const v of Object.values(desc)) {
    if (typeof v === 'string' && v.trim().length > 0) return v.trim();
  }
  return undefined;
}

/** Parse MAL ID from MangaDex links.mal (string) to number */
function parseMalLink(malLink: string | undefined): number | undefined {
  if (!malLink) return undefined;
  const parsed = parseInt(malLink, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

/** Build a MangaDexDirectResult from a manga payload plus its aggregate and chapter list. */
async function buildMangaDexDirectResult(client: MangaDexClient, best: MangaDexManga): Promise<MangaDexDirectResult> {
  const [aggregate, chapterList] = await Promise.all([
    fetchMangaDexAggregate(client, best.id),
    fetchMangaDexChapters(client, best.id),
  ]);
  return {
    mangaId: best.id, status: best.attributes.status,
    lastVolume: best.attributes.lastVolume ?? undefined,
    lastChapter: best.attributes.lastChapter ?? undefined,
    aggregate,
    chapterList,
    malId: parseMalLink(best.attributes.links?.mal),
    description: pickMangaDexDescription(best.attributes.description as Record<string, string> | null | undefined),
    externalIds: extractMangaDexLinks(best.attributes.links),
    // Phase 1: surface contentRating + publicationDemographic so the persister
    // can write the dedicated Metadata columns. Always present on attributes.
    contentRating: best.attributes.contentRating,
    publicationDemographic: best.attributes.publicationDemographic ?? undefined,
  };
}

/** Narrow a `GET /manga/{id}` payload to the manga shape the result builder reads. */
function asMangaDexManga(data: unknown): MangaDexManga | null {
  if (data === null || typeof data !== 'object') return null;
  const candidate = data as { id?: unknown; attributes?: unknown };
  if (typeof candidate.id !== 'string' || candidate.attributes === null || typeof candidate.attributes !== 'object') {
    return null;
  }
  return data as MangaDexManga;
}

/**
 * Fetch the manually pinned manga by UUID. Returns null when the API has no
 * such manga or the call fails, so the caller falls back to the matcher — the
 * user still gets a result, and the manual section is left untouched.
 */
async function fetchPinnedMangaDex(client: MangaDexClient, mangaDexId: string): Promise<MangaDexDirectResult | null> {
  let manga: MangaDexManga | null = null;
  try {
    const response: { data?: unknown } = await client.getManga(mangaDexId);
    manga = asMangaDexManga(response.data);
  } catch (error: unknown) {
    log.warn('MangaDex: manual binding fetch failed — falling back to the matcher', {
      mangaDexId, error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
  if (!manga) {
    log.warn('MangaDex: manual binding not found via API — falling back to the matcher', { mangaDexId });
    return null;
  }
  log.info('MangaDex: honoring manual binding (matcher skipped)', {
    id: manga.id,
    title: client.getEnglishTitle(manga),
    status: manga.attributes.status,
    lastVolume: manga.attributes.lastVolume,
    lastChapter: manga.attributes.lastChapter,
  });
  return { ...(await buildMangaDexDirectResult(client, manga)), manualPin: true };
}

/**
 * Fetch MangaDex metadata + aggregate volume→chapter mapping.
 * Aggregate provides ground-truth volume ranges for cross-validation.
 */
export async function fetchMangaDexDirect(
  title: string,
  directive?: ProviderDirective<string>,
): Promise<MangaDexDirectResult | null> {
  const pin = directive?.pin ?? { kind: 'none' };
  if (pin.kind === 'unbound') {
    log.info('MangaDex: skipping — manually marked as unbound', { title });
    return null;
  }
  const client = await getTsMangadexClient();
  if (pin.kind === 'pinned') {
    const pinned = await fetchPinnedMangaDex(client, pin.id);
    if (pinned) return pinned;
  } else if (pin.kind === 'unusable') {
    log.warn('MangaDex: manual binding id is not usable — running the matcher', { raw: pin.raw, reason: pin.reason });
  }

  const searchResult = await client.searchManga({ title });
  const dataArr = Array.isArray(searchResult.data) ? searchResult.data : [searchResult.data];
  // Rejected ids are removed before scoring so the matcher cannot re-land one;
  // when every hit is rejected the provider is left unbound.
  const candidates = dropRejected(dataArr, (m) => m.id, directive?.rejectedIds);
  const matched = pickBestMangaDexMatchWithScore(candidates, title, client);
  if (!matched) {
    log.info('MangaDex: no results found', { title, rejectedSkipped: dataArr.length - candidates.length });
    return null;
  }
  const rejectedSkipped = dataArr.length - candidates.length;
  if (!mayBindAfterRejection('mangadex', matched.score, rejectedSkipped)) {
    log.info('MangaDex: best remaining candidate after a rejection is too weak to bind', {
      title, id: matched.result.id, score: matched.score, rejectedSkipped,
    });
    return null;
  }
  const bestManga = matched.result;

  log.info('MangaDex: matched metadata', {
    id: bestManga.id,
    status: bestManga.attributes.status,
    lastVolume: bestManga.attributes.lastVolume,
    lastChapter: bestManga.attributes.lastChapter,
  });

  return { ...(await buildMangaDexDirectResult(client, bestManga)), matchScore: matched.score };
}

/**
 * Re-verify MangaDex match using AniList cross-reference.
 * Re-searches with AniList title variants and uses links.al pre-filtering.
 *
 * Not called for a manually pinned entity: links.al would swap in whatever
 * MangaDex manga points at the AniList id, undoing the user's choice.
 */
export async function verifyMangaDexWithAniList(
  title: string,
  anilist: { id: number; details: AniListMangaDetails },
  existing: MangaDexDirectResult | null,
  rejectedIds?: ReadonlySet<string>,
): Promise<MangaDexDirectResult | null> {
  const client = await getTsMangadexClient();
  const queries = new Set([title]);
  const romaji = anilist.details.title.romaji;
  const english = anilist.details.title.english;
  const native = anilist.details.title.native;
  if (romaji) queries.add(romaji);
  if (english) queries.add(english);
  if (native) queries.add(native);
  for (const syn of anilist.details.synonyms ?? []) {
    if (syn.length >= 3) queries.add(syn);
  }

  const seenIds = new Set<string>();
  const allResults: MangaDexManga[] = [];
  for (const q of queries) {
    // eslint-disable-next-line no-await-in-loop -- MangaDex search is rate-limited and the loop typically runs only 3-7 query variants per title; serial is safer than parallel here
    const res = await client.searchManga({ title: q });
    const arr = Array.isArray(res.data) ? res.data : [res.data];
    for (const m of arr as MangaDexManga[]) {
      if (!seenIds.has(m.id)) { seenIds.add(m.id); allResults.push(m); }
    }
  }

  const chapters = anilist.details.chapters ?? null;
  const year = anilist.details.startDate?.year ?? null;
  // A rejected manga stays rejected even when links.al points at it.
  const candidates = dropRejected(allResults, (m) => m.id, rejectedIds);
  const best = pickBestMangaDexMatch(candidates, title, client, anilist.id, chapters, year);
  if (!best) return existing;

  // If re-discovery found the same manga, keep existing (already has aggregate)
  if (existing && best.id === existing.mangaId) return existing;

  return buildMangaDexDirectResult(client, best);
}
