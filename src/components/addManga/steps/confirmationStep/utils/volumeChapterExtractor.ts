/**
 * Volume and Chapter Data Extractor Utility
 *
 * Extracts and normalizes volume/chapter data from manga sources
 */
import type { VolumeData, ChapterData } from '@/types/api/manga-router-types';

interface MangaSource {
  rawData?: {
    volumes?: VolumeData[];
    chapters?: ChapterData[];
    selectedVolumesData?: VolumeData[];
    totalVolumes?: number;
    totalChapters?: number;
    gallery?: unknown;
    images?: unknown;
  };
  volumes?: VolumeData[];
  chapters?: ChapterData[];
  totalVolumes?: number;
  totalChapters?: number;
  volumeCount?: number;
  chapterCount?: number;
  provider?: string;
  gallery?: unknown;
  images?: unknown;
  [key: string]: unknown;
}

interface VolumeChapterData {
  provider: string;
  volumes?: VolumeData[];
  chapters?: ChapterData[];
  totalVolumes?: number;
  totalChapters?: number;
}

/**
 * Extracts volume and chapter data from manga source with fallbacks
 */
// eslint-disable-next-line complexity -- Complex data extraction with multiple fallback strategies
export function extractVolumeChapterData(
  selectedResult: unknown,
  manga: MangaSource,
  source: string
): VolumeChapterData {
  const isValidSource = (value: unknown): value is MangaSource => {
    return typeof value === 'object' && value !== null;
  };

  const selectedSource = isValidSource(selectedResult) ? selectedResult : null;

  // Extract provider
  const provider =
    selectedSource?.provider ??
    manga.provider ??
    source;

  // Extract volumes with fallbacks
  const volumes =
    selectedSource?.rawData?.volumes ??
    manga.rawData?.volumes ??
    selectedSource?.rawData?.selectedVolumesData ??
    manga.volumes ??
    selectedSource?.volumes;

  // Extract chapters with fallbacks
  const chapters =
    selectedSource?.rawData?.chapters ??
    manga.rawData?.chapters ??
    manga.chapters ??
    selectedSource?.chapters;

  // Extract total volumes with fallbacks
  const totalVolumes =
    selectedSource?.rawData?.totalVolumes ??
    manga.rawData?.totalVolumes ??
    manga.totalVolumes ??
    selectedSource?.totalVolumes ??
    selectedSource?.volumeCount;

  // Extract total chapters with fallbacks
  const totalChapters =
    selectedSource?.rawData?.totalChapters ??
    manga.rawData?.totalChapters ??
    manga.totalChapters ??
    selectedSource?.totalChapters ??
    selectedSource?.chapterCount;

  return {
    provider,
    ...(volumes !== undefined ? { volumes: volumes as VolumeData[] } : {}),
    ...(chapters !== undefined ? { chapters: chapters as ChapterData[] } : {}),
    ...(totalVolumes !== undefined ? { totalVolumes } : {}),
    ...(totalChapters !== undefined ? { totalChapters } : {})
  };
}

/**
 * Extracts gallery images from manga source
 */
export function extractGalleryImages(manga: MangaSource): string[] {
  const gallery = manga.rawData?.gallery ?? manga.gallery;
  const images = manga.rawData?.images ?? manga.images;

  const galleryArray = Array.isArray(gallery) ? gallery : [];
  const imagesArray = Array.isArray(images) ? images : [];

  const combined: unknown[] = galleryArray.length > 0 ? galleryArray : imagesArray;

  // Type guard to ensure string[]
  return combined.every((item): item is string => typeof item === 'string')
    ? (combined as string[])
    : [];
}
