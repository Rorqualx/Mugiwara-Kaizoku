/**
 * Server-side helpers for the library grid / manga lists.
 *
 * `stripHeavyManga` removes per-manga blobs that list/grid cards never read —
 * `providerMetadata` (~7.5MB/page of raw provider JSON), `rawProviderData`,
 * `monitoringConfig`, `suwayomiPluginConfig`, and the big `Metadata` arrays
 * (`galleryImages` ~1.5MB, `fieldAlternatives`, `externalLinks`). Those belong
 * to the detail/edit flow (manga.get), not the list. `toGridManga` additionally
 * replaces the heavy Chapter array with a precomputed `chapterStats` aggregate
 * plus a small `recentChapters` preview, reusing the EXACT client stat logic
 * (buildChapterStats → isRealChapter + computeCardTally) so values are identical
 * to the old client-side computation.
 *
 * @module server/trpc/routers/manga/_grid-manga
 */
import { buildChapterStats } from '@/components/library/utils/chapter-stats-builder';
import { isRealChapter } from '@/components/library/utils/library-chapter-stats';

import { buildGridMangaData } from './chapter-stats-sql';

const HEAVY_MANGA_FIELDS = ['providerMetadata', 'rawProviderData', 'monitoringConfig', 'suwayomiPluginConfig'] as const;
const HEAVY_METADATA_FIELDS = ['galleryImages', 'fieldAlternatives', 'externalLinks'] as const;

/** Drop list-irrelevant blobs from a manga row (and its Metadata). */
export function stripHeavyManga(m: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...m };
  for (const f of HEAVY_MANGA_FIELDS) delete out[f];
  const meta = out['Metadata'];
  if (meta && typeof meta === 'object') {
    const slim: Record<string, unknown> = { ...(meta as Record<string, unknown>) };
    for (const f of HEAVY_METADATA_FIELDS) delete slim[f];
    out['Metadata'] = slim;
  }
  return out;
}

/** Strip heavy fields AND replace the Chapter array with the grid aggregate. */
export function toGridManga(m: Record<string, unknown> & { Chapter?: unknown }): Record<string, unknown> {
  const chapters = (m.Chapter ?? []) as Parameters<typeof buildChapterStats>[0];
  const chapterStats = buildChapterStats(chapters);
  const recentChapters = (chapters as Array<{ id: number; chapterNumber: number | null; title: string | null; isRead: boolean; downloadStatus: string; index: number }>)
    .filter((c) => isRealChapter(c))
    .sort((a, b) => Number(b.chapterNumber ?? 0) - Number(a.chapterNumber ?? 0))
    .slice(0, 5)
    .map((c) => ({ id: c.id, chapterNumber: c.chapterNumber, title: c.title, isRead: c.isRead, downloadStatus: c.downloadStatus }));
  const { Chapter: _drop, ...rest } = m;
  return { ...stripHeavyManga(rest), chapterStats, recentChapters };
}

/**
 * Finalize manga.query rows for the wire. Non-grid callers just get heavy blobs
 * stripped; the grid (chapters requested) gets the chapterStats aggregate +
 * recentChapters — computed in SQL (`buildGridMangaData`, parity-validated) when
 * enabled, else by the JS `toGridManga` over fetched chapters.
 */
export async function finalizeQueryRows<T extends { id: number }>(result: T[], includeChapters: boolean, useSqlStats: boolean): Promise<T[]> {
  if (!includeChapters) return result.map((m) => stripHeavyManga(m as Record<string, unknown>)) as unknown as T[];
  if (useSqlStats) {
    const grid = await buildGridMangaData(result.map((m) => m.id));
    return result.map((m) => {
      const g = grid.get(m.id);
      return { ...stripHeavyManga(m as Record<string, unknown>), chapterStats: g?.chapterStats, recentChapters: g?.recentChapters };
    }) as unknown as T[];
  }
  return result.map((m) => toGridManga(m as Record<string, unknown> & { Chapter?: unknown })) as unknown as T[];
}
