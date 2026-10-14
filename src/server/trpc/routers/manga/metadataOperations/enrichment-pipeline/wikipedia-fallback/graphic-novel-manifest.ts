/**
 * Wikipedia volumes read from the page's wikitext (Stage 2.4 of the fetch).
 *
 * The HTML extractors misfile chapters on common page shapes: two-column
 * chapter lists (ChapterListCol1/Col2) came back one volume late (Erased,
 * Frieren), Numbered-list volumes came back with no chapters (Attack on
 * Titan: Before the Fall), and a franchise list page was read whole (Battle
 * Angel Alita got 90 volumes and 123 chapters from four series, so the
 * cross-series gate threw the article away and ComicVine's counted ranges
 * stood alone). The `{{Graphic novel list}}` templates in the wikitext say
 * which chapters each volume holds; when they form a clean manifest for this
 * series it replaces the extracted volume list.
 *
 * @module enrichment-pipeline/wikipedia-fallback/graphic-novel-manifest
 */

import { selectGraphicNovelManifest, type GraphicNovelManifest } from '@/server/services/wikipedia/graphic-novel-list/manifest';
import { parseGraphicNovelTables, type GraphicNovelVolume } from '@/server/services/wikipedia/graphic-novel-list/wikitext-parser';
import { fetchWithRetry } from '@/server/services/wikipedia/wikipedia/api-client';
import type { WikipediaChapter, WikipediaMangaData, WikipediaVolume } from '@/server/services/wikipedia/wikipedia/types';
import { API_BASE } from '@/server/services/wikipedia/wikipedia/utils';
import { logger } from '@/utils/logger';

interface WikitextResponse {
  parse?: { title?: string; wikitext?: { '*'?: string } };
}

function chapterNumber(ch: WikipediaChapter): number {
  return typeof ch.number === 'number' ? ch.number : parseFloat(String(ch.number));
}

/** The subject of a list page title ("List of Erased chapters" → "Erased"). */
function listPageSubject(pageTitle: string): string | null {
  const match = /^Lists? of (.+?) (?:manga )?(?:chapters|volumes)$/i.exec(pageTitle);
  return match?.[1] ?? null;
}

/** Pages that may hold the series' volume tables, most specific first. */
export function candidatePages(data: WikipediaMangaData): string[] {
  const fromUrl = data.volumeListUrl ? /\/wiki\/(.+)$/.exec(data.volumeListUrl)?.[1] : undefined;
  const pages = [
    fromUrl ? decodeURIComponent(fromUrl).replace(/_/g, ' ') : undefined,
    `List of ${data.title} chapters`,
    data.title,
  ];
  return [...new Set(pages.filter((p): p is string => typeof p === 'string' && p.length > 0))];
}

async function fetchWikitext(pageTitle: string): Promise<{ title: string; wikitext: string } | null> {
  try {
    const url = `${API_BASE}?action=parse&page=${encodeURIComponent(pageTitle)}&prop=wikitext&redirects&format=json`;
    const response = await fetchWithRetry<WikitextResponse>(url);
    const wikitext = response.data.parse?.wikitext?.['*'];
    return typeof wikitext === 'string' ? { title: response.data.parse?.title ?? pageTitle, wikitext } : null;
  } catch {
    return null;
  }
}

/** Descriptive fields of an extracted volume that agrees with the manifest's chapters. */
function carriedFields(existing: WikipediaVolume | undefined, chapters: number[]): Partial<WikipediaVolume> {
  if (!existing || existing.chapters.length === 0) return {};
  const had = existing.chapters.map(chapterNumber).sort((a, b) => a - b);
  if (had.length !== chapters.length || had.some((n, i) => n !== chapters[i])) return {};
  const { number: _number, chapters: _chapters, ...rest } = existing;
  return rest;
}

/** At most this many unnumbered entries closing a finished series are read as its last chapters. */
const MAX_CLOSING_ENTRIES = 3;

/**
 * A finished series' last volume often closes with chapters the list does
 * not number: Battle Angel Alita's volume 9 ends "Fight 51, Final Fight,
 * Epilogue" (chapters 52 and 53 everywhere else), Before the Fall's volume 17
 * ends with "To a New Age" (65). Unnamed, they fell past the last volume and
 * the safety net built a tenth volume for a nine-volume series. Only the
 * entries after the last numbered chapter of the table's last volume count,
 * and only for a finished series: an ongoing series' newest volume continues
 * in the next one.
 */
function withClosingChapters(volumes: GraphicNovelVolume[], finished: boolean): GraphicNovelVolume[] {
  const last = volumes[volumes.length - 1];
  const closing = last?.trailingUnnumbered ?? 0;
  if (!finished || !last || last.chapters.length === 0 || closing < 1 || closing > MAX_CLOSING_ENTRIES) return volumes;
  const end = Math.max(...last.chapters.map(c => Math.floor(c.number)));
  const added = last.unnumbered.slice(-closing).map((entry, i) => ({
    number: end + 1 + i,
    title: /"([^"]+)"/.exec(entry)?.[1] ?? entry,
  }));
  return [...volumes.slice(0, -1), { ...last, chapters: [...last.chapters, ...added] }];
}

/** `data` with its volume list (and, on a shared page, its chapter list) taken from the manifest. */
export function applyGraphicNovelManifest(data: WikipediaMangaData, found: GraphicNovelManifest): WikipediaMangaData {
  const finished = data.status === 'COMPLETED' || data.endDate !== undefined;
  const manifest = { ...found, volumes: withClosingChapters(found.volumes, finished) };
  const existingByNumber = new Map<number, WikipediaVolume>();
  const duplicated = new Set<number>();
  for (const v of data.volumeList ?? []) {
    if (existingByNumber.has(v.number)) duplicated.add(v.number);
    existingByNumber.set(v.number, v);
  }
  const knownTitles = new Map((data.chapterList ?? []).map(ch => [chapterNumber(ch), ch.title]));
  const volumeList: WikipediaVolume[] = manifest.volumes.map(v => {
    const chapters: WikipediaChapter[] = v.chapters.map(c => {
      const title = c.title ?? (manifest.sharedPage ? undefined : knownTitles.get(c.number));
      return title ? { number: c.number, title, volumeNumber: v.number } : { number: c.number, volumeNumber: v.number };
    });
    const existing = duplicated.has(v.number) ? undefined : existingByNumber.get(v.number);
    const volume: WikipediaVolume = { ...carriedFields(existing, v.chapters.map(c => c.number)), number: v.number, chapters };
    if (v.title !== undefined) volume.title ??= v.title;
    if (v.releaseDate !== undefined) volume.originalReleaseDate ??= v.releaseDate;
    if (v.licensedReleaseDate !== undefined) volume.englishReleaseDate ??= v.licensedReleaseDate;
    if (v.isbn !== undefined) volume.isbn ??= v.isbn;
    if (v.summary !== undefined) volume.description ??= v.summary;
    return volume;
  });
  const collected = volumeList.flatMap(v => v.chapters);
  const lastCollected = Math.max(0, ...collected.map(chapterNumber));
  // A single-series page's chapters past the last volume are real (not yet
  // collected); on a shared page they are other series'. The extractors list
  // some twice (Sakamoto Days 256-277), and a list's length is read as a
  // chapter count, so each number is kept once.
  const uncollected = new Map<number, WikipediaChapter>();
  for (const { volumeNumber: _v, ...ch } of manifest.sharedPage ? [] : data.chapterList ?? []) {
    const n = chapterNumber(ch);
    if (n > lastCollected && !uncollected.has(n)) uncollected.set(n, ch);
  }
  const chapterList = [...collected, ...uncollected.values()];
  const result: WikipediaMangaData = { ...data, volumeList, chapterList };
  if (manifest.sharedPage) {
    result.chapters = lastCollected;
    result.volumes = volumeList.length;
  }
  return result;
}

/**
 * Replace `data`'s volume list with the page's Graphic novel list manifest
 * for this series, when one is found. Returns `data` unchanged otherwise.
 */
export async function withGraphicNovelManifest(
  data: WikipediaMangaData | null,
  title: string,
): Promise<WikipediaMangaData | null> {
  if (!data?.title) return data;
  for (const page of candidatePages(data)) {
    // eslint-disable-next-line no-await-in-loop -- at most three pages, stop at the first that has the series' tables
    const fetched = await fetchWikitext(page);
    if (!fetched) continue;
    const names = [title, data.title, listPageSubject(fetched.title) ?? ''].filter(n => n.length > 0);
    const manifest = selectGraphicNovelManifest(parseGraphicNovelTables(fetched.wikitext), names);
    if (!manifest) continue;
    const applied = applyGraphicNovelManifest(data, manifest);
    const ranges = applied.volumeList?.filter(v => v.chapters.length > 0).length ?? 0;
    logger.info(`[enrichmentPipeline] Wikipedia volumes from "${fetched.title}" wikitext [${manifest.headings.join(' / ')}]: ${ranges} volumes with chapters, ${applied.chapterList?.length ?? 0} chapters${manifest.sharedPage ? ' (shared page: other series dropped)' : ''}`);
    return applied;
  }
  return data;
}
