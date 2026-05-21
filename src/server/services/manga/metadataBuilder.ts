/**
 * Metadata Builder Service
 * Handles metadata creation and transformation for manga imports
 */

import { logger } from '@/utils/logger';

import type { Prisma } from '@prisma/client';

/**
 * Raw provider data structure
 */
interface RawProviderData {
  selectedCover?: string;
  coverImage?: string;
  selectedBanner?: string;
  bannerImage?: string;
  totalVolumes?: number;
  totalChapters?: number;
  volumes?: Array<{
    volumeNumber?: number;
    title?: string;
    coverImageUrl?: string;
    chapters?: unknown[];
  }>;
}

/**
 * Metadata input from API
 */
export interface MetadataInput {
  cover?: string;
  coverLarge?: string;
  description?: string;
  status?: string;
  genres?: string[];
  volumes?: number;
  chapters?: number;
  urls?: string[];
  authors?: string[];
  artists?: string[];
  alternativeTitles?: string[];
  synonyms?: string[];
  tags?: string[];
  startDate?: string;
  endDate?: string;
  bannerImage?: string;
  format?: string;
  idMal?: number;
  averageScore?: number;
  popularity?: number;
  countryOfOrigin?: string;
  publisher?: string;
  externalLinks?: unknown[];
  dynamicSections?: Record<string, unknown>;
}

/**
 * Map status from various formats to Prisma enum
 */
export function mapMangaStatus(status: string | undefined): string {
  if (!status) return 'UNKNOWN';
  const upperStatus = String(status).toUpperCase();

  switch (upperStatus) {
    case 'FINISHED':
    case 'COMPLETED':
      return 'COMPLETED';
    case 'RELEASING':
    case 'ONGOING':
      return 'ONGOING';
    case 'HIATUS':
      return 'HIATUS';
    case 'CANCELLED':
    case 'CANCELED':
      return 'CANCELLED';
    case 'NOT_YET_RELEASED':
    case 'NOT_YET_PUBLISHED':
      return 'NOT_YET_PUBLISHED';
    default:
      return 'UNKNOWN';
  }
}

/**
 * Extract cover URL from metadata or raw provider data
 */
function resolveCoverUrl(metadata: MetadataInput, rawData?: RawProviderData): string {
  return metadata.cover ??
         rawData?.selectedCover ??
         rawData?.coverImage ??
         metadata.coverLarge ??
         '/cover-not-found.jpg';
}

/**
 * Extract banner URL from metadata or raw provider data
 */
function resolveBannerUrl(metadata: MetadataInput, rawData?: RawProviderData): string | undefined {
  return metadata.bannerImage ??
         rawData?.selectedBanner ??
         rawData?.bannerImage;
}

/**
 * Extract large cover URL from metadata
 */
function resolveCoverLargeUrl(metadata: MetadataInput): string | undefined {
  return metadata.coverLarge ?? metadata.cover;
}

/**
 * Parse date string to Date object
 */
function parseDate(dateString: string | undefined): Date | null {
  return dateString ? new Date(dateString) : null;
}

/**
 * Build logging data for metadata creation
 */
function buildLoggingData(
  metadata: MetadataInput,
  rawData?: RawProviderData
): Record<string, unknown> {
  const firstVolume = rawData?.volumes?.[0];

  return {
    cover: metadata.cover,
    rawDataCover: rawData?.selectedCover ?? rawData?.coverImage,
    bannerImage: metadata.bannerImage,
    rawDataBanner: rawData?.selectedBanner ?? rawData?.bannerImage,
    volumes: metadata.volumes,
    chapters: metadata.chapters,
    rawDataVolumes: rawData?.totalVolumes,
    rawDataChapters: rawData?.totalChapters,
    rawDataVolumesArray: rawData?.volumes?.length,
    rawDataFirstVolume: firstVolume ? {
      volumeNumber: firstVolume.volumeNumber,
      title: firstVolume.title,
      coverImageUrl: firstVolume.coverImageUrl,
      chaptersCount: firstVolume.chapters?.length
    } : null,
    status: metadata.status,
    startDate: metadata.startDate,
    endDate: metadata.endDate,
    hasRawProviderData: !!rawData
  };
}

/**
 * Validate metadata values and log warnings for suspicious data
 */
function validateMetadataValues(metadata: MetadataInput): void {
  if (metadata.volumes && metadata.volumes > 1000) {
    logger.warn(`Suspicious volume count detected: ${metadata.volumes} - might be a year value`);
  }

  if (metadata.chapters && metadata.chapters < 2 && metadata.volumes && metadata.volumes > 1) {
    logger.warn(`Suspicious chapter count: only ${metadata.chapters} chapters for ${metadata.volumes} volumes`);
  }
}

/**
 * Build core metadata fields (required fields and arrays)
 */
function buildCoreFields(metadata: MetadataInput, rawData?: RawProviderData): Record<string, unknown> {
  return {
    cover: resolveCoverUrl(metadata, rawData),
    summary: metadata.description ?? '',
    status: mapMangaStatus(metadata.status),
    genres: metadata.genres ?? [],
    volumes: metadata.volumes ?? null,
    chapters: metadata.chapters ?? null,
    urls: metadata.urls ?? [],
    authors: metadata.authors ?? [],
    artists: metadata.artists ?? [],
    synonyms: metadata.alternativeTitles ?? metadata.synonyms ?? [],
    tags: metadata.tags ?? [],
    startDate: parseDate(metadata.startDate),
    endDate: parseDate(metadata.endDate)
  };
}

/**
 * Build optional image fields for metadata
 */
function buildOptionalImageFields(
  metadata: MetadataInput,
  rawData?: RawProviderData
): Record<string, string> {
  const fields: Record<string, string> = {};

  const coverLarge = resolveCoverLargeUrl(metadata);
  if (coverLarge) {
    fields['coverLarge'] = coverLarge;
  }

  const bannerImage = resolveBannerUrl(metadata, rawData);
  if (bannerImage) {
    fields['bannerImage'] = bannerImage;
  }

  return fields;
}

/**
 * Build optional metadata fields (format, scores, publisher, etc.)
 */
function buildOptionalMetadataFields(metadata: MetadataInput): Record<string, unknown> {
  const fields: Record<string, unknown> = {};

  if (metadata.format !== undefined) {
    fields['format'] = metadata.format;
  }
  if (metadata.idMal !== undefined) {
    fields['idMal'] = metadata.idMal;
  }
  if (metadata.averageScore !== undefined) {
    fields['averageScore'] = metadata.averageScore;
  }
  if (metadata.popularity !== undefined) {
    fields['popularity'] = metadata.popularity;
  }
  if (metadata.countryOfOrigin !== undefined) {
    fields['countryOfOrigin'] = metadata.countryOfOrigin;
  }
  if (metadata.publisher !== undefined) {
    fields['publisher'] = metadata.publisher;
  }

  return fields;
}

/**
 * Build external links field if present
 */
function buildExternalLinksField(metadata: MetadataInput): Record<string, string> {
  const fields: Record<string, string> = {};

  if (metadata.externalLinks ?? metadata.dynamicSections) {
    fields['externalLinks'] = JSON.stringify({
      links: metadata.externalLinks ?? [],
      dynamicSections: metadata.dynamicSections ?? {}
    });
  }

  return fields;
}

/**
 * Build metadata create input from API input and raw provider data
 */
export function buildMetadataCreateInput(
  metadata: MetadataInput,
  rawProviderData?: unknown
): Record<string, unknown> {
  const rawData = rawProviderData as RawProviderData | undefined;

  // Log the metadata being created
  logger.info('Creating metadata with:', buildLoggingData(metadata, rawData));

  // Validate the values
  validateMetadataValues(metadata);

  // Build and merge all metadata fields
  return {
    ...buildCoreFields(metadata, rawData),
    ...buildOptionalImageFields(metadata, rawData),
    ...buildOptionalMetadataFields(metadata),
    ...buildExternalLinksField(metadata)
  };
}

/**
 * Create metadata record in database
 */
export async function createMetadata(
  prisma: {
    metadata: {
      create: (args: { data: Prisma.MetadataCreateInput }) => Promise<{ id: number }>;
    };
  },
  metadata: MetadataInput,
  rawProviderData?: unknown
): Promise<number> {
  const metadataData = buildMetadataCreateInput(metadata, rawProviderData);
  const newMetadata = await prisma.metadata.create({
    data: metadataData as Prisma.MetadataCreateInput
  });
  return newMetadata.id;
}
