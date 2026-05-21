/**
 * Type Conversion Utilities
 * Helper functions for converting between different type representations
 */

import { MangaPublicationStatus } from '@prisma/client';

import {
  type SourceInfo,
  type NormalizedImage,
  type ExternalLink
} from '../core/DataNormalizer';

/**
 * Convert string or object to SourceInfo
 */
export function createSourceInfo(input: string | Partial<SourceInfo>): SourceInfo {
  if (typeof input === 'string') {
    return {
      url: input,
      type: 'other',
      extractedAt: new Date(),
      confidence: 0.8
    };
  }
  
  return {
    type: 'other',
    extractedAt: new Date(),
    confidence: 0.8,
    ...input
  };
}

/**
 * Convert string to MangaStatus enum
 */
export function convertToMangaStatus(status: string | MangaPublicationStatus): MangaPublicationStatus {
  // If already a valid MangaPublicationStatus, return it
  if (Object.values(MangaPublicationStatus).includes(status as MangaPublicationStatus)) {
    return status as MangaPublicationStatus;
  }
  
  const statusMap: Record<string, MangaPublicationStatus> = {
    'ongoing': MangaPublicationStatus.ONGOING,
    'on-going': MangaPublicationStatus.ONGOING,
    'publishing': MangaPublicationStatus.ONGOING,
    'releasing': MangaPublicationStatus.ONGOING,
    'completed': MangaPublicationStatus.COMPLETED,
    'finished': MangaPublicationStatus.COMPLETED,
    'ended': MangaPublicationStatus.COMPLETED,
    'hiatus': MangaPublicationStatus.HIATUS,
    'on hiatus': MangaPublicationStatus.HIATUS,
    'on-hiatus': MangaPublicationStatus.HIATUS,
    'cancelled': MangaPublicationStatus.CANCELLED,
    'canceled': MangaPublicationStatus.CANCELLED,
    'discontinued': MangaPublicationStatus.CANCELLED,
    'not_yet_released': MangaPublicationStatus.NOT_YET_PUBLISHED,
    'not yet released': MangaPublicationStatus.NOT_YET_PUBLISHED,
    'upcoming': MangaPublicationStatus.NOT_YET_PUBLISHED,
    'tba': MangaPublicationStatus.NOT_YET_PUBLISHED,
    'unknown': MangaPublicationStatus.UNKNOWN
  };
  
  const normalized = status.toLowerCase().trim();
  return statusMap[normalized] ?? MangaPublicationStatus.UNKNOWN;
}

/**
 * Convert string array to NormalizedImage array
 */
export function convertToNormalizedImages(images: string[] | NormalizedImage[]): NormalizedImage[] {
  if (!Array.isArray(images)) {
    return [];
  }
  
  return images.map(img => {
    if (typeof img === 'string') {
      return {
        url: img,
        type: 'other' as const
      };
    }
    return img;
  });
}

/**
 * Convert to ExternalLink array with proper structure
 */
export function convertToExternalLinks(
  links: Array<{site: string, url: string}> | ExternalLink[]
): ExternalLink[] {
  if (!Array.isArray(links)) {
    return [];
  }
  
  return links.map(link => {
    // If already a proper ExternalLink
    if ('type' in link && 'label' in link) {
      return link as ExternalLink;
    }
    
    // Convert from {site, url} format
    if ('site' in link) {
      return {
        url: link.url,
        type: determineExternalLinkType(link.url),
        label: link.site
      };
    }
    
    // Fallback
    return link as ExternalLink;
  });
}

/**
 * Determine external link type from URL
 */
function determineExternalLinkType(url: string): ExternalLink['type'] {
  const lower = url.toLowerCase();
  
  if (lower.includes('wikipedia.org') || lower.includes('fandom.com')) {
    return 'wiki';
  }
  if (lower.includes('mangadex.org') || lower.includes('mangaupdates.com')) {
    return 'database';
  }
  if (lower.includes('amazon.') || lower.includes('bookwalker.')) {
    return 'store';
  }
  if (lower.includes('official') || lower.includes('.jp')) {
    return 'official';
  }
  
  return 'other';
}

/**
 * Convert null to undefined for proper typing
 */
export function nullToUndefined<T>(value: T | null): T | undefined {
  return value ?? undefined;
}

/**
 * Convert undefined to null (for database operations)
 */
export function undefinedToNull<T>(value: T | undefined): T | null {
  return value ?? null;
}

/**
 * Safely convert date strings to Date objects
 */
export function toDate(value: string | Date | undefined | null): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  
  try {
    const date = new Date(value);
    return isNaN(date.getTime()) ? undefined : date;
  } catch {
    return undefined;
  }
}

/**
 * Convert various number formats to number
 */
export function toNumber(value: string | number | null | undefined): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'number') return value;

  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? undefined : parsed;
}

/**
 * Ensure array type
 */
export function ensureArray<T>(value: T | T[] | null | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

/**
 * Clean and normalize string
 */
export function normalizeString(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Type guard for MangaPublicationStatus
 */
export function isMangaStatus(value: unknown): value is MangaPublicationStatus {
  return Object.values(MangaPublicationStatus).includes(value as MangaPublicationStatus);
}

/**
 * Type guard for SourceInfo
 */
export function isSourceInfo(value: unknown): value is SourceInfo {
  return Boolean(value &&
    typeof value === 'object' &&
    'type' in value &&
    'extractedAt' in value &&
    'confidence' in value);
}