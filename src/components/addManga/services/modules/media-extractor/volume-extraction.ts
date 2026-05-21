import type * as React from 'react';

import { getVolumeCoverUrl } from '@/components/addManga/utils/typeGuards';
import type { MediaGallery, Volume } from '@/types/universalImportWizard.types';
import { logger } from '@/utils/logger';

/**
 * Collect volume cover URLs from metadata volumeData
 */
export function collectVolumeCoverUrls(
  volumeData: Volume[] | undefined
): Set<string> {
  const volumeCoverUrls = new Set<string>();

  if (volumeData && Array.isArray(volumeData)) {
    volumeData.forEach((volume) => {
      const coverUrl = volume.coverUrl ?? volume.coverImage ?? volume.coverImageUrl;
      if (coverUrl && typeof coverUrl === 'string') {
        volumeCoverUrls.add(coverUrl);
        // Add variations to catch different formats
        if (coverUrl.includes('/revision/')) {
          const parts = coverUrl.split('/revision/');
          if (parts[0]) {
            const baseUrl = parts[0];
            volumeCoverUrls.add(baseUrl);
            volumeCoverUrls.add(baseUrl + '/revision/latest');
          }
        }
      }
    });
  }

  return volumeCoverUrls;
}

/**
 * Extract volume covers from volumeData and volumes arrays
 */
export function extractVolumeCovers(
  volumeData: Volume[] | undefined,
  volumes: unknown[] | undefined
): string[] {
  const volumeCovers: string[] = [];

  // Check multiple patterns for volume covers
  if (volumeData && Array.isArray(volumeData)) {
    volumeData.forEach((volume: Volume) => {
      // Safely extract cover URL with proper type checking
      let coverUrl: string | undefined;
      const volumeRecord = volume as unknown as Record<string, unknown>;
      if (typeof volumeRecord['coverUrl'] === 'string') {
        coverUrl = volumeRecord['coverUrl'];
      } else if (typeof volumeRecord['coverImage'] === 'string') {
        coverUrl = volumeRecord['coverImage'];
      } else if (typeof volumeRecord['coverImageUrl'] === 'string') {
        coverUrl = volumeRecord['coverImageUrl'];
      } else {
        coverUrl = getVolumeCoverUrl(volumeRecord);
      }

      if (coverUrl && typeof coverUrl === 'string' && !volumeCovers.includes(coverUrl)) {
        volumeCovers.push(coverUrl);
      }
    });
  }

  if (volumes && Array.isArray(volumes)) {
    volumes.forEach((volume) => {
      // Safely extract cover URL with proper type checking
      let coverUrl: string | undefined;
      const volumeRecord = volume as unknown as Record<string, unknown>;
      if (typeof volumeRecord['coverUrl'] === 'string') {
        coverUrl = volumeRecord['coverUrl'];
      } else if (typeof volumeRecord['coverImage'] === 'string') {
        coverUrl = volumeRecord['coverImage'];
      } else if (typeof volumeRecord['coverImageUrl'] === 'string') {
        coverUrl = volumeRecord['coverImageUrl'];
      } else {
        coverUrl = getVolumeCoverUrl(volumeRecord);
      }

      if (coverUrl && typeof coverUrl === 'string' && !volumeCovers.includes(coverUrl)) {
        volumeCovers.push(coverUrl);
      }
    });
  }

  return volumeCovers;
}

/**
 * Update media gallery with volume covers
 */
export function updateGalleryWithVolumeCovers(
  volumeCovers: string[],
  provider: string,
  setMediaGallery: React.Dispatch<React.SetStateAction<MediaGallery>>
): void {
  if (volumeCovers.length > 0) {
    logger.info(`📚 [Primary Volume Covers] ${provider} has ${volumeCovers.length} volume covers`);
    setMediaGallery((prev) => ({
      ...prev,
      volumeCovers: [...new Set([...prev.volumeCovers, ...volumeCovers])]
    }));
  }
}

/**
 * Extract chapter covers from nested chapters inside volumeData
 */
export function extractChapterCovers(volumeData: Volume[] | undefined): string[] {
  const chapterCovers: string[] = [];

  if (volumeData && Array.isArray(volumeData)) {
    volumeData.forEach((volume: Volume) => {
      const volumeRecord = volume as unknown as Record<string, unknown>;
      const chapters = volumeRecord['chapters'];

      if (Array.isArray(chapters)) {
        chapters.forEach((chapter: unknown) => {
          if (typeof chapter === 'object' && chapter !== null) {
            const chapterRecord = chapter as Record<string, unknown>;
            // Check for chapter cover URL in various field names
            const chapterCoverUrl =
              (typeof chapterRecord['coverImageUrl'] === 'string' ? chapterRecord['coverImageUrl'] : undefined) ??
              (typeof chapterRecord['coverUrl'] === 'string' ? chapterRecord['coverUrl'] : undefined) ??
              (typeof chapterRecord['coverImage'] === 'string' ? chapterRecord['coverImage'] : undefined);

            if (chapterCoverUrl && !chapterCovers.includes(chapterCoverUrl)) {
              chapterCovers.push(chapterCoverUrl);
            }
          }
        });
      }
    });
  }

  return chapterCovers;
}

/**
 * Update media gallery with chapter covers
 */
export function updateGalleryWithChapterCovers(
  chapterCovers: string[],
  provider: string,
  setMediaGallery: React.Dispatch<React.SetStateAction<MediaGallery>>
): void {
  if (chapterCovers.length > 0) {
    logger.info(`📖 [Primary Chapter Covers] ${provider} has ${chapterCovers.length} chapter covers`);
    setMediaGallery((prev) => ({
      ...prev,
      chapterCovers: [...new Set([...prev.chapterCovers, ...chapterCovers])]
    }));
  }
}
