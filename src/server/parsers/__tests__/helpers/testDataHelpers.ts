/**
 * Test Data Helper Functions
 * Utilities for creating valid test data structures with proper typing
 */


import { MangaPublicationStatus } from '@prisma/client';

import type { 
  ChapterData, 
  VolumeData, 
  ExtractedContent,
  ExtractedLink,
  ValidationResult,
  Gallery,
  StoryArc,
  TabbedContent,
  Conflict
} from '@/server/parsers/core/ContentExtractor';
import {
  type NormalizedMangaData,
  type NormalizedVolume,
  type NormalizedChapter,
  type NormalizedImage,
  type ExternalLink,
  type SourceInfo
} from '@/server/parsers/core/DataNormalizer';
import type { DetectedFormat } from '@/server/parsers/core/FormatDetector';
import type { ExtractedImage } from '@/server/parsers/extractors/ImageExtractor';
import type { ExtractedMetadata } from '@/server/parsers/extractors/MetadataExtractor';
import type { TableData } from '@/server/parsers/extractors/TableExtractor';


/**
 * Create a valid ChapterData object for tests
 */
export function createTestChapter(partial: Partial<ChapterData> = {}): ChapterData {
  return {
    chapterNumber: '1',
    source: 'table' as const,
    ...partial
  };
}

/**
 * Create a valid VolumeData object for tests
 */
export function createTestVolume(partial: Partial<VolumeData> = {}): VolumeData {
  return {
    volumeNumber: 1,
    chapters: [],
    source: 'table' as const,
    ...partial
  };
}

/**
 * Create a valid ExtractedContent object for tests
 */
export function createTestExtractedContent(partial: Partial<ExtractedContent> = {}): ExtractedContent {
  return {
    format: createTestFormat(),
    metadata: {},
    tables: [],
    images: [],
    volumes: [],
    chapters: [],
    links: [],
    ...partial
  };
}

/**
 * Create a valid DetectedFormat object for tests
 */
export function createTestFormat(partial: Partial<DetectedFormat> = {}): DetectedFormat {
  const defaultRule = {
    name: 'generic',
    priority: 100,
    detect: () => true,
    features: {}
  };
  
  return {
    primary: defaultRule,
    alternatives: [],
    features: {
      hasPortableInfobox: false,
      hasReferences: false,
      hasStandardTables: false,
      hasWikiaGallery: false,
      usesCustomFormat: false
    },
    confidence: 1,
    signals: [],
    ...partial
  };
}

/**
 * Create a valid ExtractedMetadata object for tests
 */
export function createTestMetadata(partial: Partial<ExtractedMetadata> = {}): ExtractedMetadata {
  return {
    title: 'Test Manga',
    ...partial
  };
}

/**
 * Create a valid ExtractedImage object for tests
 */
export function createTestImage(partial: Partial<ExtractedImage> = {}): ExtractedImage {
  return {
    url: 'test.jpg',
    type: 'cover',
    ...partial
  };
}

/**
 * Create a valid TableData object for tests
 */
export function createTestTable(partial: Partial<TableData> = {}): TableData {
  return {
    headers: [],
    rows: [],
    type: 'generic',
    ...partial
  };
}

/**
 * Create a valid ExtractedLink object for tests
 */
export function createTestLink(partial: Partial<ExtractedLink> = {}): ExtractedLink {
  return {
    url: 'http://test.com',
    text: 'Test Link',
    type: 'external',
    ...partial
  };
}

/**
 * Create a valid NormalizedMangaData object for tests
 */
export function createTestNormalizedManga(partial: Partial<NormalizedMangaData> = {}): NormalizedMangaData {
  return {
    title: 'Test Manga',
    status: MangaPublicationStatus.ONGOING,
    volumes: [],
    chapters: [],
    source: createTestSourceInfo(),
    ...partial
  };
}

/**
 * Create a valid SourceInfo object for tests
 */
export function createTestSourceInfo(partial: Partial<SourceInfo> = {}): SourceInfo {
  return {
    type: 'other',
    extractedAt: new Date(),
    confidence: 0.8,
    ...partial
  };
}

/**
 * Create a valid NormalizedVolume object for tests
 */
export function createTestNormalizedVolume(partial: Partial<NormalizedVolume> = {}): NormalizedVolume {
  return {
    number: 1,
    chapters: [],
    ...partial
  };
}

/**
 * Create a valid NormalizedChapter object for tests
 */
export function createTestNormalizedChapter(partial: Partial<NormalizedChapter> = {}): NormalizedChapter {
  return {
    number: 1,
    ...partial
  };
}

/**
 * Create a valid NormalizedImage object for tests
 */
export function createTestNormalizedImage(partial: Partial<NormalizedImage> = {}): NormalizedImage {
  return {
    url: 'test.jpg',
    type: 'cover',
    ...partial
  };
}

/**
 * Create a valid ExternalLink object for tests
 */
export function createTestExternalLink(partial: Partial<ExternalLink> = {}): ExternalLink {
  return {
    url: 'http://test.com',
    type: 'other' as const,
    label: 'Test Link',
    ...partial
  };
}

/**
 * Create a valid ValidationResult object for tests
 */
export function createTestValidationResult(partial: Partial<ValidationResult> = {}): ValidationResult {
  return {
    isValid: true,
    errors: [],
    warnings: [],
    ...partial
  };
}

/**
 * Create a valid Gallery object for tests
 */
export function createTestGallery(partial: Partial<Gallery> = {}): Gallery {
  return {
    images: [],
    ...partial
  };
}

/**
 * Create a valid StoryArc object for tests
 */
export function createTestStoryArc(partial: Partial<StoryArc> = {}): StoryArc {
  return {
    name: 'Test Arc',
    ...partial
  };
}

/**
 * Create a valid TabbedContent object for tests
 */
export function createTestTabbedContent(partial: Partial<TabbedContent> = {}): TabbedContent {
  return {
    tabName: 'Test Tab',
    content: {},
    ...partial
  };
}

/**
 * Create a valid Conflict object for tests
 */
export function createTestConflict(partial: Partial<Conflict> = {}): Conflict {
  return {
    field: 'test',
    values: [],
    ...partial
  };
}

/**
 * Convert string to MangaPublicationStatus enum
 */
export function toMangaStatus(status: string): MangaPublicationStatus {
  const statusMap: Record<string, MangaPublicationStatus> = {
    'ongoing': MangaPublicationStatus.ONGOING,
    'completed': MangaPublicationStatus.COMPLETED,
    'hiatus': MangaPublicationStatus.HIATUS,
    'cancelled': MangaPublicationStatus.CANCELLED,
    'not_yet_released': MangaPublicationStatus.NOT_YET_PUBLISHED,
    'not_yet_published': MangaPublicationStatus.NOT_YET_PUBLISHED,
    'upcoming': MangaPublicationStatus.UPCOMING,
    'unknown': MangaPublicationStatus.UNKNOWN
  };
  return statusMap[status.toLowerCase()] ?? MangaPublicationStatus.UNKNOWN;
}

/**
 * Convert string array to NormalizedImage array
 */
export function toNormalizedImages(urls: string[]): NormalizedImage[] {
  return urls.map(url => ({
    url,
    type: 'other' as const
  }));
}

/**
 * Convert to ExternalLink array
 */
export function toExternalLinks(links: Array<{site: string, url: string}>): ExternalLink[] {
  return links.map(link => ({
    url: link.url,
    type: 'other' as const,
    label: link.site
  }));
}

/**
 * Helper to handle null to undefined conversion
 */
export function nullToUndefined<T>(value: T | null): T | undefined {
  return value ?? undefined;
}