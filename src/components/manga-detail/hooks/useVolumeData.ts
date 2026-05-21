/**
 * Volume Data Hook
 *
 * Custom hook for calculating volume statistics and grouping chapters by volume.
 * Merges chapter-based volume grouping with enriched Volume table metadata.
 */

import { useMemo } from 'react';

import type { MangaWithMetadataAndChapters } from '../types';

export interface VolumeMetadata {
  title: string | null;
  coverImage: string | null;
  releaseDate: Date | null;
  isbn: string | null;
  pageCount: number | null;
  description: string | null;
  publisher: string | null;
}

export interface VolumeEntry {
  volumeNumber: number;
  chapters: NonNullable<MangaWithMetadataAndChapters['chapters']>;
  metadata?: VolumeMetadata | undefined;
}

export interface VolumeData {
  totalSize: number;
  volumes: VolumeEntry[];
}

type ChapterArray = NonNullable<MangaWithMetadataAndChapters['chapters']>;

function resolveVolumeNumber(chapter: ChapterArray[number]): number {
  if (typeof chapter.volume === 'number' && chapter.volume > 0) {
    return chapter.volume;
  }
  if (chapter.fileName) {
    const match = chapter.fileName.match(/v(\d+)/i);
    if (match?.[1]) return parseInt(match[1], 10);
  }
  return -1;
}

function groupChaptersByVolume(chapters: ChapterArray): Map<number, ChapterArray> {
  const volumeMap = new Map<number, ChapterArray>();

  for (const chapter of chapters) {
    const volumeNumber = resolveVolumeNumber(chapter);
    let group = volumeMap.get(volumeNumber);
    if (!group) {
      group = [];
      volumeMap.set(volumeNumber, group);
    }
    group.push(chapter);
  }

  for (const group of volumeMap.values()) {
    group.sort((a, b) => a.index - b.index);
  }

  return volumeMap;
}

function buildVolumeEntries(
  volumeMap: Map<number, ChapterArray>,
  dbVolumes?: MangaWithMetadataAndChapters['volumes'],
): VolumeEntry[] {
  const metadataMap = new Map<number, NonNullable<typeof dbVolumes>[number]>();
  dbVolumes?.forEach(vol => metadataMap.set(vol.number, vol));

  return Array.from(volumeMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([volumeNumber, chapters]) => {
      const dbVol = metadataMap.get(volumeNumber);
      return {
        volumeNumber,
        chapters,
        metadata: dbVol ? {
          title: dbVol.title,
          coverImage: dbVol.coverImage,
          releaseDate: dbVol.releaseDate,
          isbn: dbVol.isbn,
          pageCount: dbVol.pageCount,
          description: dbVol.description,
          publisher: dbVol.publisher,
        } : undefined,
      };
    });
}

export function useVolumeData(manga: MangaWithMetadataAndChapters): VolumeData {
  const volumeData = useMemo(() => {
    const totalSize = manga.chapters?.reduce((sum, ch) => sum + ch.size, 0) ?? 0;
    const volumeMap = groupChaptersByVolume(manga.chapters ?? []);
    const volumes = buildVolumeEntries(volumeMap, manga.volumes);
    return { totalSize, volumes };
  }, [manga]);

  return volumeData;
}
