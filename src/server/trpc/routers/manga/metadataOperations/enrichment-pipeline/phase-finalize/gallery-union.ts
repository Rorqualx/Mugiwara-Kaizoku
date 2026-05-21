/**
 * Always-run gallery image collection from Volume + Chapter covers.
 *
 * Unions volume cover images and chapter cover images into
 * Metadata.galleryImages. Runs regardless of which enrichment path fired,
 * so titles with ComicVine-derived volume covers but no Fandom enrichment
 * still populate the gallery.
 *
 * UNION semantics: merges with existing galleryImages (which may already
 * contain Fandom gallery images or ComicVine associatedImages).
 */

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

export async function unionVolumeChapterCoversIntoGallery(mangaId: number): Promise<void> {
  try {
    const [volumes, chapters, metadata] = await Promise.all([
      prisma.volume.findMany({
        where: { mangaId, coverImage: { not: null } },
        select: { coverImage: true },
        orderBy: { number: 'asc' },
      }),
      prisma.chapter.findMany({
        where: { mangaId, coverImage: { not: null } },
        select: { coverImage: true },
        orderBy: { chapterNumber: 'asc' },
      }),
      prisma.metadata.findFirst({
        where: { Manga: { id: mangaId } },
        select: { id: true, galleryImages: true },
      }),
    ]);
    if (!metadata) return;

    const union = new Set<string>(metadata.galleryImages);
    const before = union.size;
    for (const v of volumes) {
      if (v.coverImage) union.add(v.coverImage);
    }
    for (const c of chapters) {
      if (c.coverImage) union.add(c.coverImage);
    }
    const added = union.size - before;
    if (added === 0) return;

    await prisma.metadata.update({
      where: { id: metadata.id },
      data: { galleryImages: [...union] },
    });
    logger.info(
      `[enrichmentPipeline] Gallery union: added ${added} images from volumes+chapters ` +
      `(total ${union.size}) for manga ${mangaId}`,
    );
  } catch (err) {
    logger.debug(`[enrichmentPipeline] Gallery union failed for manga ${mangaId} (non-critical)`, err);
  }
}
