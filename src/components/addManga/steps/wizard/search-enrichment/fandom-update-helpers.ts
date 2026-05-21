/**
 * Fandom Update Helper Functions
 *
 * Internal helpers for updating Fandom metadata state.
 */

import { extractPrimaryProviderMedia } from '@/components/addManga/services/modules/mediaExtractor';
import type { Chapter, ProviderMetadata, Volume } from '@/types/universalImportWizard.types';
import { logger } from '@/utils/logger';

import type { EnrichmentContext } from './types';

/**
 * Count chapter covers in volume details array
 */
export function countChapterCoversInVolumes(volumeDetails: unknown): number {
  if (!Array.isArray(volumeDetails)) return 0;

  let count = 0;
  for (const vol of volumeDetails) {
    const volObj = vol as Record<string, unknown>;
    const chapters = volObj['chapters'];
    if (!Array.isArray(chapters)) continue;

    for (const ch of chapters) {
      const chObj = ch as Record<string, unknown>;
      if (chObj['coverImageUrl']) count++;
    }
  }
  return count;
}

/**
 * Update Fandom metadata with parsed volume/gallery data
 */
export function updateFandomMetadata(
  parsed: Record<string, unknown>,
  ctx: EnrichmentContext
): void {
  const { primaryProvider, primaryMetadata, setSelectedSourcesMetadata, setMediaGallery } = ctx;

  setSelectedSourcesMetadata((prev) => {
    const currentMetadata = prev[primaryProvider] ?? primaryMetadata;

    let mergedVolumeData: Volume[] = currentMetadata.volumeData ?? [];
    if (Array.isArray(parsed['volumeDetails']) && parsed['volumeDetails'].length > 0) {
      const parsedVolumes = parsed['volumeDetails'] as Volume[];
      const existingVolumes = currentMetadata.volumeData ?? [];

      const existingHasCovers = existingVolumes.some((vol: Volume) =>
        vol.chapters?.some((ch: Chapter) => ch.coverImageUrl)
      );
      const parsedHasCovers = parsedVolumes.some((vol: Volume) =>
        vol.chapters?.some((ch: Chapter) => ch.coverImageUrl)
      );

      if (existingHasCovers && !parsedHasCovers) {
        mergedVolumeData = existingVolumes;
      } else {
        mergedVolumeData = parsedVolumes;
      }
    }

    const enrichedMetadata: ProviderMetadata = {
      ...currentMetadata,
      gallery:
        Array.isArray(parsed['gallery']) && parsed['gallery'].length > 0
          ? (parsed['gallery'] as string[])
          : (currentMetadata.gallery ?? []),
      volumeData: mergedVolumeData,
      volumes:
        typeof parsed['volumes'] === 'number' && parsed['volumes'] > 0
          ? parsed['volumes']
          : (currentMetadata.volumes ?? 0),
      chapters:
        typeof parsed['chapters'] === 'number' && parsed['chapters'] > 0
          ? parsed['chapters']
          : (currentMetadata.chapters ?? 0),
    };

    extractPrimaryProviderMedia(primaryProvider, enrichedMetadata, setMediaGallery);

    return { ...prev, [primaryProvider]: enrichedMetadata };
  });
}

/**
 * Update Fandom metadata with full metadata fields (description, genres, authors, etc.)
 */
export function updateFandomFullMetadata(
  data: Record<string, unknown>,
  ctx: EnrichmentContext
): void {
  const { primaryProvider, primaryMetadata, setSelectedSourcesMetadata, updateFormData } = ctx;

  // eslint-disable-next-line complexity -- Fandom metadata mapping with 15+ field extractions
  setSelectedSourcesMetadata((prev) => {
    const currentMetadata = prev[primaryProvider] ?? primaryMetadata;
    const enrichedMetadata: ProviderMetadata = { ...currentMetadata };

    if (data['description'] && typeof data['description'] === 'string') {
      enrichedMetadata.description = data['description'];
      enrichedMetadata.synopsis = data['description'];
    }
    if (data['cover'] && typeof data['cover'] === 'string') {
      enrichedMetadata.coverImage = data['cover'];
    }
    if (data['status'] && typeof data['status'] === 'string') {
      enrichedMetadata.status = data['status'];
    }
    if (Array.isArray(data['genres']) && data['genres'].length > 0) {
      enrichedMetadata.genres = data['genres'] as string[];
    }
    if (Array.isArray(data['authors']) && data['authors'].length > 0) {
      enrichedMetadata.authors = data['authors'] as string[];
    }
    if (Array.isArray(data['alternativeTitles']) && data['alternativeTitles'].length > 0) {
      enrichedMetadata.alternativeTitles = data['alternativeTitles'] as string[];
    }
    if (data['originalRun'] && typeof data['originalRun'] === 'string') {
      const originalRun = data['originalRun'];
      if (typeof originalRun === 'string' && !enrichedMetadata.startDate) {
        enrichedMetadata.startDate = originalRun;
      }
    }
    if (typeof data['myAnimeListId'] === 'number') {
      enrichedMetadata.idMal = data['myAnimeListId'];
    } else if (typeof data['myAnimeListId'] === 'string' && data['myAnimeListId'].length > 0) {
      enrichedMetadata.idMal = parseInt(data['myAnimeListId'], 10);
    }
    if (data['startDate'] && typeof data['startDate'] === 'string') {
      enrichedMetadata.startDate = data['startDate'];
    }
    if (data['endDate'] && typeof data['endDate'] === 'string') {
      enrichedMetadata.endDate = data['endDate'];
    }

    return { ...prev, [primaryProvider]: enrichedMetadata };
  });

  if (data['description'] && typeof data['description'] === 'string') {
    updateFormData({ description: data['description'] });
    logger.info('[SearchEnrichment] Updated form with Fandom description');
  }
  if (Array.isArray(data['authors']) && data['authors'].length > 0) {
    updateFormData({ authors: data['authors'] as string[] });
    logger.info('[SearchEnrichment] Updated form with Fandom authors:', data['authors']);
  }
  if (typeof data['myAnimeListId'] === 'number') {
    updateFormData({ idMal: data['myAnimeListId'] });
    logger.info('[SearchEnrichment] Updated form with Fandom MAL ID:', data['myAnimeListId']);
  }
}

/**
 * Update volumes data from Fandom parse result
 */
export function updateFandomVolumes(
  parsed: Record<string, unknown>,
  ctx: EnrichmentContext
): void {
  if (!Array.isArray(parsed['volumeDetails']) || parsed['volumeDetails'].length === 0) {
    return;
  }

  const parsedVolumes = parsed['volumeDetails'] as Volume[];

  const parsedHasCovers = parsedVolumes.some((vol: Volume) =>
    vol.chapters?.some((ch: Chapter) => ch.coverImageUrl)
  );

  ctx.setVolumesData((prev) => {
    const existingVolumes = prev.volumes;
    const existingHasCovers = existingVolumes.some((vol: Volume) =>
      vol.chapters?.some((ch: Chapter) => ch.coverImageUrl)
    );

    if (existingHasCovers && !parsedHasCovers) {
      logger.debug('[SearchEnrichment] Keeping existing volumes with chapter covers');
      return prev;
    }

    const totalChaps = parsedVolumes.reduce((sum: number, vol) => {
      const chapters = Array.isArray(vol.chapters) ? vol.chapters.length : 0;
      const chapterCount = typeof vol.chapterCount === 'number' ? vol.chapterCount : 0;
      return sum + (chapters || chapterCount);
    }, 0);

    return {
      ...prev,
      volumes: parsedVolumes,
      totalVolumes: parsedVolumes.length,
      totalChapters: totalChaps,
    };
  });

  logger.info('[SearchEnrichment] Updated volumes from Fandom parse:', {
    volumeCount: parsedVolumes.length,
  });
}
