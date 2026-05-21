/**
 * MangaDex Chapter List Fetcher
 *
 * Fetches per-chapter data from MangaDex to surface `attributes.pages` so
 * downstream fill steps can populate Chapter.pages (which is missing for
 * most manga because neither Wikipedia, Fandom, nor ComicVine reliably
 * report page counts per chapter).
 *
 * We paginate via `getMangaChapters` at the 100-per-page API cap.
 * The vendor library's `getAllChapters` is broken: it requests limit=500,
 * which the `/chapter` endpoint rejects with "Non-feed limit query param
 * may not be >100", and the first empty response stops the loop.
 *
 * Dedupe: MangaDex returns one row per scanlator upload, so the same
 * chapter number appears multiple times. Keep the entry with the highest
 * page count, tie-break on title presence.
 */

import { mangadexConfigService } from '@/server/services/mangadex/configService';
import { isPreferredLanguage } from '@/server/services/mangadex/language-match';
import type { KaizokuMangaDexClient } from '@/server/services/mangadex/ts-client-factory';
import { logger } from '@/utils/logger';

import type { ChapterDataItem } from '../types';

const log = logger.child('MangaDexChapterList');

const PAGE_LIMIT = 100;
const MAX_PAGES = 50; // 5000 chapters — far beyond any real manga
const DEFAULT_PREFERRED_LANGUAGE = 'en';

interface MangaDexChapterAttributes {
  title?: string;
  volume?: string;
  chapter?: string;
  pages: number;
  externalUrl?: string;
  publishAt?: string;
  translatedLanguage?: string;
}

interface MangaDexChapter {
  attributes: MangaDexChapterAttributes;
}

interface ChapterListResponse {
  data?: MangaDexChapter[];
  total?: number;
}

function toItem(ch: MangaDexChapter): ChapterDataItem | null {
  const attrs = ch.attributes;
  if (attrs.externalUrl) return null;
  const num = parseFloat(attrs.chapter ?? '');
  if (!Number.isFinite(num) || num < 0) return null;
  // MangaDex returns `pages: 0` for chapters that have a metadata entry but
  // no uploaded scanlation pages yet. Keep them — `volume` / `title` /
  // `publishAt` are still load-bearing for volume mapping. Reject only
  // negative page counts (genuinely malformed).
  const rawPages = typeof attrs.pages === 'number' ? attrs.pages : 0;
  if (rawPages < 0) return null;
  const pages = rawPages;

  const item: ChapterDataItem = { number: num, pages };
  if (attrs.title && attrs.title.trim().length > 0) item.title = attrs.title.trim();
  const volNum = parseInt(attrs.volume ?? '', 10);
  if (Number.isFinite(volNum) && volNum >= 0) item.volume = volNum;
  if (attrs.publishAt) item.releaseDate = attrs.publishAt;
  if (attrs.translatedLanguage) item.language = attrs.translatedLanguage;
  return item;
}

function isPreferred(item: ChapterDataItem, preferredLanguage: string): boolean {
  return isPreferredLanguage(item.language, preferredLanguage);
}

/**
 * Tier-aware dedup: a preferred-language entry always wins over a
 * non-preferred one regardless of page count. Within the same tier, prefer
 * higher page count; tie-break on title presence.
 *
 * This was added to fix titles like Omniscient Reader's Viewpoint where
 * the Portuguese scanlation team uploaded longer chapters than the English
 * team, so the old "highest pages wins" rule surfaced "Prólogo" /
 * "Iniciando Serviço Pago Parte 1" as chapter titles in an English
 * library.
 */
function shouldReplace(
  prior: ChapterDataItem,
  next: ChapterDataItem,
  preferredLanguage: string,
): boolean {
  const priorPref = isPreferred(prior, preferredLanguage);
  const nextPref = isPreferred(next, preferredLanguage);
  if (nextPref && !priorPref) return true;
  if (priorPref && !nextPref) return false;

  const priorPages = prior.pages ?? 0;
  const nextPages = next.pages ?? 0;
  if (nextPages > priorPages) return true;
  if (nextPages === priorPages && !prior.title && next.title) return true;
  return false;
}

async function getPreferredLanguage(): Promise<string> {
  try {
    const cfg = await mangadexConfigService.getMetadataConfig();
    const lang = cfg.preferredLanguage.trim();
    return lang.length > 0 ? lang : DEFAULT_PREFERRED_LANGUAGE;
  } catch (err) {
    log.warn('Failed to load mangadex.preferredLanguage; defaulting to en', {
      error: err instanceof Error ? err.message : String(err),
    });
    return DEFAULT_PREFERRED_LANGUAGE;
  }
}

export async function fetchMangaDexChapters(
  client: KaizokuMangaDexClient,
  mangaId: string,
): Promise<ChapterDataItem[]> {
  try {
    const preferredLanguage = await getPreferredLanguage();
    const raw: MangaDexChapter[] = [];
    let offset = 0;
    // Metadata-side fetch: catalog every chapter MangaDex knows about, in
    // every available language. The download side has its own
    // `mangadex.preferredLanguage` setting that decides which translation
    // to actually download — this fetcher is only building the chapter list
    // (numbers, titles, volume groupings, page counts) for the library.
    // Restricting languages here makes Vol 5-8 disappear for series whose
    // English translation is incomplete (e.g. Iken Senki Volundio: 22 EN
    // chapters but ~95 across vi/es-la/ru/zh combined). `shouldReplace`
    // dedups by chapter number, preferring the highest-page upload.
    for (let page = 0; page < MAX_PAGES; page++) {
      // eslint-disable-next-line no-await-in-loop -- pagination is inherently sequential; next offset depends on prior response
      const resp = await client.getMangaChapters(mangaId, {
        limit: PAGE_LIMIT,
        offset,
        order: { chapter: 'asc' },
      }) as ChapterListResponse;
      const batch = Array.isArray(resp.data) ? resp.data : [];
      raw.push(...batch);
      const total = resp.total ?? 0;
      if (batch.length < PAGE_LIMIT || raw.length >= total) break;
      offset += PAGE_LIMIT;
    }

    if (raw.length === 0) return [];

    const bestByNumber = new Map<number, ChapterDataItem>();
    for (const ch of raw) {
      const item = toItem(ch);
      if (!item) continue;
      const prior = bestByNumber.get(item.number);
      if (!prior || shouldReplace(prior, item, preferredLanguage)) bestByNumber.set(item.number, item);
    }

    const sorted = [...bestByNumber.values()].sort((a, b) => a.number - b.number);
    const inPreferred = sorted.filter(c => isPreferred(c, preferredLanguage)).length;
    // Strict-preferred-language titles: keep the volume/pages/releaseDate
    // metadata from the best-available scanlation (so series with incomplete
    // EN translations like Iken Senki Volundio still get Vol 5-8 mapping)
    // but drop the `title` field when the kept item isn't in preferred
    // language. Mai Otome Zwei had 0 EN chapters and the page-count tier
    // was silently surfacing French scanlation titles ("Le rêve continue").
    // Downstream `chapter-title-fill.ts` skips entries without titles, so
    // Wikipedia/Fandom/ComicVine title sources naturally fill the gap.
    let stripped = 0;
    const result = sorted.map(item => {
      if (item.title && !isPreferred(item, preferredLanguage)) {
        stripped++;
        const { title: _drop, ...rest } = item;
        return rest;
      }
      return item;
    });
    log.info('Fetched MangaDex chapters', {
      mangaId,
      raw: raw.length,
      deduped: result.length,
      preferredLanguage,
      inPreferredLanguage: inPreferred,
      titlesStrippedNonPreferred: stripped,
    });
    return result;
  } catch (err: unknown) {
    log.debug('MangaDex chapter fetch failed (non-critical)', {
      mangaId,
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}
