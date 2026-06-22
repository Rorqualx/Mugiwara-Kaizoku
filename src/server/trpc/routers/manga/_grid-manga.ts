/**
 * Server-side helper for the library grid: replace a manga's heavy Chapter
 * array with a precomputed aggregate (`chapterStats`) plus a small
 * `recentChapters` preview. Reuses the EXACT client stat logic
 * (buildChapterStats → isRealChapter + computeCardTally) so the server-computed
 * values are identical to the old client-side computation.
 *
 * @module server/trpc/routers/manga/_grid-manga
 */
import { buildChapterStats } from '@/components/library/utils/chapter-stats-builder';
import { isRealChapter } from '@/components/library/utils/library-chapter-stats';

export function toGridManga(m: Record<string, unknown> & { Chapter?: unknown }): Record<string, unknown> {
  const chapters = (m.Chapter ?? []) as Parameters<typeof buildChapterStats>[0];
  const chapterStats = buildChapterStats(chapters);
  const recentChapters = (chapters as Array<{ id: number; chapterNumber: number | null; title: string | null; isRead: boolean; downloadStatus: string; index: number }>)
    .filter((c) => isRealChapter(c))
    .sort((a, b) => Number(b.chapterNumber ?? 0) - Number(a.chapterNumber ?? 0))
    .slice(0, 5)
    .map((c) => ({ id: c.id, chapterNumber: c.chapterNumber, title: c.title, isRead: c.isRead, downloadStatus: c.downloadStatus }));
  const { Chapter: _drop, ...rest } = m;
  return { ...rest, chapterStats, recentChapters };
}
