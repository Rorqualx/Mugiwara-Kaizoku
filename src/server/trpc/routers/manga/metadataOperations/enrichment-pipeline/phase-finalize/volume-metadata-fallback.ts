/**
 * Volume metadata fallbacks
 *
 * When per-volume description/cover data isn't available from any provider,
 * fall back to the series-level Metadata values. The series summary
 * accurately describes every volume; the series cover is a safer default
 * for UIs than a blank.
 *
 * Fill-when-null only — real per-volume data always wins.
 */

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

export async function fillVolumeFallbacksFromMetadata(mangaId: number): Promise<void> {
  try {
    const manga = await prisma.manga.findUnique({
      where: { id: mangaId },
      select: {
        Metadata: { select: { summary: true, coverLarge: true, coverExtraLarge: true } },
      },
    });
    const md = manga?.Metadata;
    if (!md) return;

    let descs = 0;
    let covers = 0;
    if (md.summary && md.summary.trim().length > 0) {
      const r = await prisma.volume.updateMany({
        where: { mangaId, description: null },
        data: { description: md.summary },
      });
      descs = r.count;
    }
    const seriesCover = md.coverExtraLarge ?? md.coverLarge;
    if (seriesCover && seriesCover.trim().length > 0) {
      const r = await prisma.volume.updateMany({
        where: { mangaId, coverImage: null },
        data: { coverImage: seriesCover },
      });
      covers = r.count;
    }
    if (descs + covers > 0) {
      logger.info(`[enrichmentPipeline] Filled ${descs} volume descriptions and ${covers} volume covers from series metadata for manga ${mangaId}`);
    }
  } catch (err) {
    logger.warn(`[enrichmentPipeline] Failed to fill volume fallbacks from metadata for manga ${mangaId} (non-critical)`, err);
  }
}
