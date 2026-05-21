/**
 * Fandom Metadata Extractors
 *
 * Functions for extracting volume and chapter metadata from Fandom wiki data.
 *
 * @module components/library/import-pipeline/utils/chapter-matching-utils/fandom-extractors
 */

import type { MetadataChapter, MetadataVolume } from '@/components/library/import-pipeline/types';
import type { FandomChapter, FandomMetadata, FandomVolume } from '@/types/provider-metadata.types';

// ============================================================================
// Helper Functions
// ============================================================================

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function safeGetRecord(obj: Record<string, unknown>, key: string): Record<string, unknown> | undefined {
  const value = obj[key];
  return isRecord(value) ? value : undefined;
}

function safeGetArray(obj: Record<string, unknown>, key: string): unknown[] | undefined {
  const value = obj[key];
  return Array.isArray(value) ? value : undefined;
}

// ============================================================================
// Type Guards
// ============================================================================

export function isFandomMetadata(meta: unknown): meta is FandomMetadata {
  if (!meta || typeof meta !== 'object') return false;
  const m = meta as Record<string, unknown>;
  return 'volumeData' in m || 'volumeDetails' in m || (typeof m['metadata'] === 'object' && m['metadata'] !== null);
}

// ============================================================================
// Fandom Extraction
// ============================================================================

/**
 * Find Fandom volumes from nested metadata paths
 */
// eslint-disable-next-line complexity -- Nested metadata path traversal across multiple Fandom data structures
export function findFandomVolumesFromMetadata(metadata: Record<string, unknown>): FandomVolume[] | null {
  const directVolumeData = safeGetArray(metadata, 'volumeData') ?? safeGetArray(metadata, 'volumeDetails');
  if (directVolumeData && directVolumeData.length > 0) {
    return directVolumeData as FandomVolume[];
  }

  const fandomVolumes = metadata['fandom_volumes'];
  if (fandomVolumes) {
    if (Array.isArray(fandomVolumes) && fandomVolumes.length > 0) {
      return fandomVolumes as FandomVolume[];
    }
    if (isRecord(fandomVolumes)) {
      const volumes = safeGetArray(fandomVolumes, 'volumes') ?? safeGetArray(fandomVolumes, 'volumeDetails');
      if (volumes && volumes.length > 0) {
        return volumes as FandomVolume[];
      }
    }
  }

  const fandomUpperData = safeGetRecord(metadata, 'FANDOM');
  if (fandomUpperData) {
    const volumeDetails = safeGetArray(fandomUpperData, 'volumeDetails') ?? safeGetArray(fandomUpperData, 'volumes');
    if (volumeDetails && volumeDetails.length > 0) {
      return volumeDetails as FandomVolume[];
    }
    const fandomMeta = safeGetRecord(fandomUpperData, 'metadata');
    if (fandomMeta) {
      const metaVolumeDetails = safeGetArray(fandomMeta, 'volumeDetails');
      if (metaVolumeDetails && metaVolumeDetails.length > 0) {
        return metaVolumeDetails as FandomVolume[];
      }
    }
  }

  const fandomChapters = safeGetRecord(metadata, 'fandom_chapters');
  if (fandomChapters) {
    const chapMeta = safeGetRecord(fandomChapters, 'metadata');
    if (chapMeta) {
      const volumeDetails = safeGetArray(chapMeta, 'volumeDetails');
      if (volumeDetails && volumeDetails.length > 0) {
        return volumeDetails as FandomVolume[];
      }
    }
  }

  const fandomData = safeGetRecord(metadata, 'fandom');
  if (fandomData) {
    const volumeDetails = safeGetArray(fandomData, 'volumeDetails') ?? safeGetArray(fandomData, 'volumeData');
    if (volumeDetails && volumeDetails.length > 0) {
      return volumeDetails as FandomVolume[];
    }
  }

  return null;
}

/**
 * Extract and normalize chapters from Fandom metadata
 */
// eslint-disable-next-line complexity -- Chapter extraction with volume grouping and chapter number normalization
export function extractFandomChapters(metadata: FandomMetadata, provider: string): {
  volumes: MetadataVolume[];
  chapters: MetadataChapter[];
} {
  const volumes: MetadataVolume[] = [];
  const allChapters: MetadataChapter[] = [];

  const volumeData: FandomVolume[] =
    metadata.volumeData ?? metadata.volumeDetails ?? metadata.metadata?.volumeDetails ?? [];

  for (const volume of volumeData) {
    const volumeNumber = volume.volumeNumber ?? volume.number;
    if (volumeNumber === undefined) continue;

    // Get volume cover first so chapters can inherit it
    const volCover = volume.coverImage ?? volume.coverImageUrl ?? volume.cover;

    const volumeChapters: MetadataChapter[] = [];
    const fandomChapters: FandomChapter[] = volume.chapters ?? [];

    for (const chapter of fandomChapters) {
      const chapterNumber = chapter.chapterNumber ?? chapter.number;
      if (chapterNumber === undefined) continue;

      const metaChapter: MetadataChapter = {
        id: `${provider}-vol${volumeNumber}-ch-${chapterNumber}`,
        provider,
        number: chapterNumber,
        volumeNumber,
      };
      if (chapter.title) metaChapter.title = chapter.title;
      // Chapter cover: use chapter's own cover, or inherit from volume
      const chapterCover = chapter.coverImage ?? chapter.coverImageUrl ?? volCover;
      if (chapterCover) {
        metaChapter.coverImage = chapterCover;
      }
      if (chapter.pages) metaChapter.pages = chapter.pages;
      if (chapter.releaseDate) metaChapter.releaseDate = chapter.releaseDate;
      // Check for summary, description, or synopsis (API may return any of these)
      const chapterDesc = chapter.summary ?? chapter.description ?? chapter.synopsis;
      if (chapterDesc) metaChapter.summary = chapterDesc;
      if (chapter.url) metaChapter.url = chapter.url;

      volumeChapters.push(metaChapter);
      allChapters.push(metaChapter);
    }

    volumeChapters.sort((a, b) => a.number - b.number);

    const metaVolume: MetadataVolume = {
      id: `${provider}-vol-${volumeNumber}`,
      provider,
      number: volumeNumber,
      chapters: volumeChapters,
      chapterCount: volumeChapters.length,
    };
    const volTitle = volume.title ?? volume.name;
    if (volTitle) metaVolume.title = volTitle;
    if (volCover) metaVolume.coverImage = volCover;

    volumes.push(metaVolume);
  }

  volumes.sort((a, b) => a.number - b.number);
  allChapters.sort((a, b) => a.number - b.number);

  return { volumes, chapters: allChapters };
}
