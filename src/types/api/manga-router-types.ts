/**
 * Type definitions for the manga tRPC router
 *
 * This file contains all type definitions used in /src/server/trpc/routers/manga.ts
 * to eliminate the use of `any` types throughout the router.
 */

import type { Prisma, MetadataProvider } from '@prisma/client';

/**
 * Prisma context with database client
 */
export interface PrismaContext {
  prisma: {
    chapter: {
      createMany: (args: Prisma.ChapterCreateManyArgs) => Promise<Prisma.BatchPayload>;
      deleteMany: (args: Prisma.ChapterDeleteManyArgs) => Promise<Prisma.BatchPayload>;
    };
    [key: string]: unknown;
  };
}

/**
 * Raw provider data from wizard/import process
 */
export interface RawProviderData {
  selectedCover?: string;
  coverImage?: string;
  selectedBanner?: string;
  bannerImage?: string;
  totalVolumes?: number;
  totalChapters?: number;
  volumes?: VolumeData[];
  chapters?: ChapterData[];
  metadata?: ProviderMetadataRecord;
  [key: string]: unknown;
}

/**
 * Volume data structure from providers
 */
export interface VolumeData {
  number: number;
  title: string;
  chapters?: ChapterData[];
  coverImage?: string;
  releaseDate?: string;
  pages?: number;
  // Legacy field support for backward compatibility
  volumeNumber?: number;
  coverImageUrl?: string;
  summary?: string;
  [key: string]: unknown;
}

/**
 * Chapter data structure from providers
 */
export interface ChapterData {
  chapterNumber?: number;
  number?: number;
  title?: string;
  index?: number;
  pages?: number;
  releaseDate?: string;
  [key: string]: unknown;
}

/**
 * Provider metadata record with nested metadata
 */
export interface ProviderMetadataRecord {
  issues?: IssueData[];
  volumeList?: VolumeData[];
  totalChapters?: number;
  volumes?: VolumeData[];
  chapters?: ChapterData[];
  authors?: string[];
  artists?: string[];
  author?: string;
  artist?: string;
  publisher?: string;
  published?: string;
  magazine?: string;
  demographic?: string;
  alternativeTitles?: string[];
  volumesListUrl?: string;
  issueCount?: number;
  count_of_issues?: number;
  siteDetailUrl?: string;
  site_detail_url?: string;
  startYear?: number;
  start_year?: number;
  rawData?: RawDataNested;
  importProfile?: ImportProfile;
  [key: string]: unknown;
}

/**
 * Nested raw data in provider metadata
 */
export interface RawDataNested {
  count_of_issues?: number;
  issues?: IssueData[];
  chapters?: ChapterData[];
  [key: string]: unknown;
}

/**
 * Issue data from ComicVine
 */
export interface IssueData {
  issue_number?: number;
  issueNumber?: number;
  name?: string;
  title?: string;
  image?: {
    original_url?: string;
    medium_url?: string;
    small_url?: string;
  };
  [key: string]: unknown;
}

/**
 * Import profile configuration
 */
export interface ImportProfile {
  providerId?: string;
  providerType?: MetadataProvider;
  externalId?: string;
  selectedProvider?: string;
  autoUpdate?: boolean;
  primarySource?: string;
  chapterSource?: string;
  selectedChapters?: number;
  totalAvailableChapters?: number;
  [key: string]: unknown;
}

/**
 * Source data from metadata fetching
 */
export interface SourceData {
  metadata?: ProviderMetadataRecord;
  rawData?: RawDataNested;
  issues?: IssueData[];
  chapters?: ChapterData[];
  volumes?: VolumeData[];
  volumeData?: VolumeData[];
  volumeDetails?: VolumeData[] | Record<string, unknown>;
  selectedVolumesData?: VolumeData[];
  volumeCovers?: string[];
  chapterCovers?: string[];
  gallery?: string[];
  images?: string[];
  [key: string]: unknown;
}

/**
 * Metadata with all optional fields from Prisma
 */
export interface MetadataFields extends Partial<Omit<Prisma.MetadataCreateInput, 'manga' | 'id' | 'createdAt' | 'updatedAt'>> {
  [key: string]: unknown;
}

/**
 * URL data structure
 */
export interface UrlData {
  url: string;
  [key: string]: unknown;
}

/**
 * External link structure
 */
export interface ExternalLink {
  url?: string;
  type?: string;
  site?: string;
  wikiUrl?: string;
  [key: string]: unknown;
}

/**
 * Job payload for download tasks
 */
export interface DownloadJobPayload {
  clientType?: string;
  method?: string;
  mode?: string;
  prowlarrResult?: {
    title?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * Job result for download tasks
 */
export interface DownloadJobResult {
  fileSize?: number;
  releaseTitle?: string;
  [key: string]: unknown;
}

/**
 * Job error structure
 */
export interface JobError {
  message?: string;
  [key: string]: unknown;
}

/**
 * Complete job structure
 */
export interface Job {
  id: string | number;
  status: string;
  created_at: Date | string;
  payload: DownloadJobPayload;
  result?: DownloadJobResult;
  last_error?: JobError;
  [key: string]: unknown;
}

/**
 * Raw search item from providers
 */
export interface RawSearchItem {
  id?: string | number;
  title?: string;
  url?: string;
  wikiUrl?: string;
  siteDetailUrl?: string;
  volumesListUrl?: string;
  volumes?: VolumeData[];
  chapters?: ChapterData[];
  authors?: string[];
  artists?: string[];
  author?: string;
  artist?: string;
  publisher?: string;
  published?: string;
  magazine?: string;
  demographic?: string;
  alternativeTitles?: string[];
  startYear?: number;
  start_year?: number;
  metadata?: ProviderMetadataRecord;
  [key: string]: unknown;
}

/**
 * Raw data container
 */
export interface RawDataContainer {
  volumes?: VolumeData[];
  chapters?: ChapterData[];
  volumesListUrl?: string;
  authors?: string[];
  artists?: string[];
  author?: string;
  artist?: string;
  publisher?: string;
  published?: string;
  magazine?: string;
  demographic?: string;
  metadata?: ProviderMetadataRecord;
  [key: string]: unknown;
}

/**
 * Enriched volume with additional metadata
 */
export interface EnrichedVolume extends VolumeData {
  imageUrl?: string;
  issueCount?: number;
  [key: string]: unknown;
}

/**
 * Fandom data structure
 */
export interface FandomData {
  metadata?: ProviderMetadataRecord;
  volumeData?: VolumeData[];
  chapters?: ChapterData[];
  stats?: {
    totalVolumes?: number;
    totalChapters?: number;
  };
  [key: string]: unknown;
}

/**
 * Provider data with volumes/chapters
 */
export interface ProviderData {
  metadata?: ProviderMetadataRecord;
  volumes?: VolumeData[];
  chapters?: ChapterData[];
  [key: string]: unknown;
}

/**
 * Existing raw data object
 */
export interface ExistingRawData {
  providerMetadata?: {
    comicvine?: {
      volumeData?: EnrichedVolume[];
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * Result with additional properties
 */
export interface ResultData {
  [key: string]: unknown;
}

/**
 * Type guard for PrismaContext
 */
export function isPrismaContext(ctx: unknown): ctx is PrismaContext {
  return (
    typeof ctx === 'object' &&
    ctx !== null &&
    'prisma' in ctx &&
    typeof (ctx as PrismaContext).prisma === 'object'
  );
}

/**
 * Type guard for RawProviderData
 */
export function isRawProviderData(data: unknown): data is RawProviderData {
  return typeof data === 'object' && data !== null;
}

/**
 * Type guard for ProviderMetadataRecord
 */
export function isProviderMetadataRecord(data: unknown): data is ProviderMetadataRecord {
  return typeof data === 'object' && data !== null;
}

/**
 * Type guard for SourceData
 */
export function isSourceData(data: unknown): data is SourceData {
  return typeof data === 'object' && data !== null;
}

/**
 * Type guard for Job
 */
export function isJob(job: unknown): job is Job {
  return (
    typeof job === 'object' &&
    job !== null &&
    'id' in job &&
    'status' in job &&
    'payload' in job
  );
}

/**
 * Type guard for ExternalLink
 */
export function isExternalLink(link: unknown): link is ExternalLink {
  return typeof link === 'object' && link !== null;
}

/**
 * Type guard for RawSearchItem
 */
export function isRawSearchItem(item: unknown): item is RawSearchItem {
  return typeof item === 'object' && item !== null;
}
