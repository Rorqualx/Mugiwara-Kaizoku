/**
 * Post-finalize fill: populate Chapter.coverImage from the parent Volume's
 * coverImage when the chapter has no cover of its own AND its volumeId links
 * to a volume that does.
 *
 * Pure DB read+update — no external API calls. Only fills chapters with
 * null coverImage and a set volumeId; never overrides.
 *
 * Round 6 iter 60.
 */

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

export async function fillChapterCoverFromVolume(mangaId: number): Promise<void> {
  try {
    const chapters = await prisma.chapter.findMany({
      where: {
        mangaId,
        coverImage: null,
        volumeId: { not: null },
      },
      select: { id: true, volumeId: true },
    });
    if (chapters.length === 0) return;

    const volumeIds = [...new Set(chapters.map(c => c.volumeId).filter((v): v is number => v !== null))];
    if (volumeIds.length === 0) return;

    const volumes = await prisma.volume.findMany({
      where: { id: { in: volumeIds }, coverImage: { not: null } },
      select: { id: true, coverImage: true },
    });
    if (volumes.length === 0) return;

    const coverByVolumeId = new Map<number, string>();
    for (const v of volumes) {
      if (v.coverImage) coverByVolumeId.set(v.id, v.coverImage);
    }

    let filled = 0;
    for (const c of chapters) {
      if (c.volumeId === null) continue;
      const volCover = coverByVolumeId.get(c.volumeId);
      if (!volCover) continue;
      // eslint-disable-next-line no-await-in-loop -- per-chapter sequential update keeps DB pressure low
      await prisma.chapter.update({ where: { id: c.id }, data: { coverImage: volCover } });
      filled++;
    }

    if (filled > 0) {
      logger.info(`[enrichmentPipeline] Filled ${filled} chapter covers from parent volumes for manga ${mangaId}`);
    }
  } catch (err) {
    logger.warn(`[enrichmentPipeline] fillChapterCoverFromVolume failed for manga ${mangaId} (non-critical)`, err);
  }
}
