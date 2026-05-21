/**
 * Post-finalize fill step that overwrites placeholder "Chapter N" titles
 * with real titles from Wikipedia's or Fandom's chapterList.
 *
 * Wikipedia's chapterList is assembled by the adaptive extractor early in
 * the pipeline but only its chapter *count* feeds reconciliation; real
 * titles get dropped unless Fandom also has them. This pass picks them up
 * post-finalize, covering titles where Fandom is sparse (e.g. 20th Century
 * Boys, Monster).
 *
 * Fandom's chapterList takes priority over Wikipedia's (Fandom titles are
 * usually more accurate / wiki-native). Fill-when-generic only — explicit
 * non-generic titles from earlier phases are never overridden.
 *
 * Secondary (volume, number) lookup handles per-volume-numbered tables
 * that slip past the upstream renumbering repair.
 */

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

import type { UnifiedProviderResults } from '../types';

const GENERIC_CHAPTER_TITLE = /^Chapter\s*\d+(?:\.\d+)?$/i;

interface ProviderChapter {
  number: number;
  title?: string;
  volume?: number;
}

interface TitleMaps {
  byNumber: Map<number, string>;
  byVolumeAndNumber: Map<string, string>;
}

export async function fillGenericChapterTitlesFromProviders(
  mangaId: number,
  providerResults: UnifiedProviderResults,
): Promise<void> {
  try {
    const rawFandom = providerResults.fandomResult?.chapterList ?? [];
    const wikipediaChapters = providerResults.wikipediaResult?.chapterList ?? [];
    const mangadexChapters = providerResults.mangadexChapterList ?? [];
    // Same multi-series-wiki gate as reconcileFromProviderResults: when Fandom
    // floods with >2× MangaDex's count it's a series-wide catalog (e.g.
    // jojo.fandom.com), and its chapter titles belong to other parts.
    const fandomChapters = (mangadexChapters.length >= 10 && rawFandom.length > mangadexChapters.length * 2.0)
      ? []
      : rawFandom;
    const { byNumber, byVolumeAndNumber } = buildTitleMaps(mangadexChapters, wikipediaChapters, fandomChapters);
    if (byNumber.size === 0 && byVolumeAndNumber.size === 0) return;

    const volumeNumberById = await loadVolumeNumbers(mangaId);
    const generic = await prisma.chapter.findMany({
      where: { mangaId, chapterNumber: { not: null } },
      select: { id: true, chapterNumber: true, title: true, volumeId: true, mangadexId: true },
    });

    let filled = 0;
    for (const c of generic) {
      if (c.chapterNumber === null) continue;
      const newTitle = resolveTitle(c.chapterNumber, c.volumeId, volumeNumberById, byNumber, byVolumeAndNumber);
      if (!newTitle) continue;
      if (c.title && !GENERIC_CHAPTER_TITLE.test(c.title)) {
        // Existing title is non-generic. Only overwrite when it looks like a
        // stale MangaDex foreign-language remnant: the chapter is
        // mangadexId-bound AND a different provider (Wikipedia/Fandom/CV)
        // has a different title now. The MangaDex chapter-list itself no
        // longer emits non-preferred-language titles (see
        // `mangadex-chapter-list.ts` strict-preferred-language fix), so any
        // mangadex-contributed entry in `byNumber` here came from a
        // confirmed preferred-language scanlation OR from a different
        // provider — both are safe to overwrite with.
        if (c.mangadexId === null || c.title === newTitle) continue;
      }
      // eslint-disable-next-line no-await-in-loop -- per-chapter sequential update
      await prisma.chapter.update({ where: { id: c.id }, data: { title: newTitle } });
      filled++;
    }
    if (filled > 0) {
      logger.info(`[enrichmentPipeline] Filled ${filled} generic chapter titles from MangaDex/Wikipedia/Fandom for manga ${mangaId}`);
    }
  } catch (err) {
    logger.warn(`[enrichmentPipeline] Failed to fill generic chapter titles for manga ${mangaId} (non-critical)`, err);
  }
}

function resolveTitle(
  chapterNumber: number,
  volumeId: number | null,
  volumeNumberById: Map<number, number>,
  byNumber: Map<number, string>,
  byVolumeAndNumber: Map<string, string>,
): string | undefined {
  const primary = byNumber.get(chapterNumber);
  if (primary) return primary;
  if (volumeId === null) return undefined;
  const volNum = volumeNumberById.get(volumeId);
  if (volNum === undefined) return undefined;
  return byVolumeAndNumber.get(`${volNum}:${chapterNumber}`);
}

async function loadVolumeNumbers(mangaId: number): Promise<Map<number, number>> {
  const volumes = await prisma.volume.findMany({
    where: { mangaId },
    select: { id: true, number: true },
  });
  const map = new Map<number, number>();
  for (const v of volumes) {
    map.set(v.id, v.number);
  }
  return map;
}

/** Merge provider chapter title maps. Ingested in priority order: MangaDex (lowest), Wikipedia, Fandom (highest — wins on conflict). */
function buildTitleMaps(
  mangadexChapters: ProviderChapter[],
  wikipediaChapters: ProviderChapter[],
  fandomChapters: ProviderChapter[],
): TitleMaps {
  const byNumber = new Map<number, string>();
  const byVolumeAndNumber = new Map<string, string>();
  const ingest = (chs: ProviderChapter[]): void => {
    for (const ch of chs) {
      if (typeof ch.title !== 'string' || GENERIC_CHAPTER_TITLE.test(ch.title)) continue;
      const title = ch.title.trim();
      if (title.length === 0) continue;
      byNumber.set(ch.number, title);
      if (ch.volume !== undefined) byVolumeAndNumber.set(`${ch.volume}:${ch.number}`, title);
    }
  };
  ingest(mangadexChapters);
  ingest(wikipediaChapters);
  ingest(fandomChapters);
  return { byNumber, byVolumeAndNumber };
}
