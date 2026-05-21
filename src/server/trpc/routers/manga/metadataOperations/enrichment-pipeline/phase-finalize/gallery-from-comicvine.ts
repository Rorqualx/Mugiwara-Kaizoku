/**
 * Post-finalize gallery enrichment from ComicVine.
 *
 * Reads `associatedImages` URLs that the ComicVine volume mapper attached
 * to each in-memory volume entry (under `enrichmentResult.enrichedData.manga.volumes`)
 * and unions them into `Metadata.galleryImages`. Works regardless of
 * whether Fandom data is present — covers CV-only series.
 *
 * Dedupe: unions with any existing galleryImages; de-duplicates via Set.
 */

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

import type { UnifiedProviderResults } from '../types';

export async function appendComicVineGalleryImages(
  mangaId: number,
  providerResults: UnifiedProviderResults,
): Promise<void> {
  try {
    const enrichedData = providerResults.enrichmentResult.enrichedData as Record<string, unknown> | undefined;
    const unifiedManga = enrichedData?.['manga'] as Record<string, unknown> | undefined;
    const volumes = (unifiedManga?.['volumes'] ?? []) as Array<Record<string, unknown>>;
    if (volumes.length === 0) return;

    const newUrls: string[] = [];
    for (const v of volumes) {
      const assoc = v['associatedImages'];
      if (!Array.isArray(assoc)) continue;
      for (const u of assoc) {
        if (typeof u === 'string' && u.length > 0) newUrls.push(u);
      }
    }
    if (newUrls.length === 0) return;

    const metadata = await prisma.metadata.findFirst({
      where: { Manga: { id: mangaId } },
      select: { id: true, galleryImages: true },
    });
    if (!metadata) return;

    const union = new Set<string>(metadata.galleryImages);
    const before = union.size;
    for (const u of newUrls) union.add(u);
    const added = union.size - before;
    if (added === 0) return;

    await prisma.metadata.update({
      where: { id: metadata.id },
      data: { galleryImages: [...union] },
    });
    logger.info(`[enrichmentPipeline] Gallery: added ${added} ComicVine associated images (total ${union.size}) for manga ${mangaId}`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.debug(`[enrichmentPipeline] ComicVine gallery append failed (non-critical): ${msg}`);
  }
}
