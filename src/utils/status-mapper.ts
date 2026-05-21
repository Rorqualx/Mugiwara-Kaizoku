/**
 * Consolidated Status Mapping Utility
 *
 * This module provides the SINGLE SOURCE OF TRUTH for all status mappings
 * in the application. All status conversions must use these functions.
 *
 * @module status-mapper
 * @canonical true
 */
import { MangaPublicationStatus, ChapterStatus } from '@prisma/client';

import { logger } from '../utils/logger';
/**
 * Comprehensive list of all known status strings across all providers
 */
export const KNOWN_STATUS_STRINGS = {
    // Ongoing/Active variants
    ONGOING: ['ongoing', 'publishing', 'serialization', 'releasing', 'current', 'continuing', 'active', 'in progress', 'in-progress'],
    // Completed variants (using "finished" as primary display term)
    COMPLETED: ['finished', 'completed', 'ended', 'complete', 'done', 'fin'],
    // Hiatus variants
    HIATUS: ['hiatus', 'on hold', 'on-hold', 'paused', 'suspended', 'break', 'on break', 'on-break'],
    // Cancelled variants
    CANCELLED: ['cancelled', 'canceled', 'discontinued', 'abandoned', 'dropped', 'axed'],
    // Upcoming variants
    UPCOMING: ['upcoming', 'not yet released', 'not-yet-released', 'tba', 'to be announced', 'planned', 'announced'],
    // Unknown/Other
    UNKNOWN: ['unknown', 'other', 'n/a', 'na', 'none', '']
} as const;
/**
 * Provider-specific status mappings
 */
const PROVIDER_STATUS_MAP = {
    anilist: {
        'RELEASING': MangaPublicationStatus.ONGOING,
        'CURRENT': MangaPublicationStatus.ONGOING,
        'FINISHED': MangaPublicationStatus.COMPLETED,
        'CANCELLED': MangaPublicationStatus.CANCELLED,
        'CANCELED': MangaPublicationStatus.CANCELLED,
        'HIATUS': MangaPublicationStatus.HIATUS,
        'NOT_YET_RELEASED': MangaPublicationStatus.UPCOMING
    },
    comicvine: {
        'Active': MangaPublicationStatus.ONGOING,
        'Completed': MangaPublicationStatus.COMPLETED,
        'Cancelled': MangaPublicationStatus.CANCELLED,
        'Discontinued': MangaPublicationStatus.CANCELLED,
        'Hiatus': MangaPublicationStatus.HIATUS
    },
    fandom: {
        'Ongoing': MangaPublicationStatus.ONGOING,
        'Publishing': MangaPublicationStatus.ONGOING,
        'Active': MangaPublicationStatus.ONGOING,
        'Completed': MangaPublicationStatus.COMPLETED,
        'Finished': MangaPublicationStatus.COMPLETED,
        'Cancelled': MangaPublicationStatus.CANCELLED,
        'Discontinued': MangaPublicationStatus.CANCELLED,
        'Hiatus': MangaPublicationStatus.HIATUS,
        'On Hold': MangaPublicationStatus.HIATUS
    }
} as const;

/**
 * Reverse mapping: MangaPublicationStatus -> Provider-specific string
 * Used for converting domain status back to provider format
 */
const REVERSE_PROVIDER_STATUS_MAP: Record<string, Partial<Record<MangaPublicationStatus, string>>> = {
    anilist: {
        [MangaPublicationStatus.ONGOING]: 'RELEASING',
        [MangaPublicationStatus.COMPLETED]: 'FINISHED',
        [MangaPublicationStatus.CANCELLED]: 'CANCELLED',
        [MangaPublicationStatus.HIATUS]: 'HIATUS',
        [MangaPublicationStatus.NOT_YET_PUBLISHED]: 'NOT_YET_RELEASED',
        [MangaPublicationStatus.UPCOMING]: 'NOT_YET_RELEASED',
        [MangaPublicationStatus.NOT_YET_RELEASED]: 'NOT_YET_RELEASED',
        [MangaPublicationStatus.UNKNOWN]: 'UNKNOWN'
    },
    comicvine: {
        [MangaPublicationStatus.ONGOING]: 'Active',
        [MangaPublicationStatus.COMPLETED]: 'Completed',
        [MangaPublicationStatus.CANCELLED]: 'Cancelled',
        [MangaPublicationStatus.HIATUS]: 'Hiatus',
        [MangaPublicationStatus.NOT_YET_PUBLISHED]: 'Upcoming',
        [MangaPublicationStatus.UPCOMING]: 'Upcoming',
        [MangaPublicationStatus.NOT_YET_RELEASED]: 'Upcoming',
        [MangaPublicationStatus.UNKNOWN]: 'Unknown'
    },
    fandom: {
        [MangaPublicationStatus.ONGOING]: 'Ongoing',
        [MangaPublicationStatus.COMPLETED]: 'Completed',
        [MangaPublicationStatus.CANCELLED]: 'Cancelled',
        [MangaPublicationStatus.HIATUS]: 'Hiatus',
        [MangaPublicationStatus.NOT_YET_PUBLISHED]: 'Upcoming',
        [MangaPublicationStatus.UPCOMING]: 'Upcoming',
        [MangaPublicationStatus.NOT_YET_RELEASED]: 'Upcoming',
        [MangaPublicationStatus.UNKNOWN]: 'Unknown'
    }
};

/**
 * Type guard to check if a value is a valid status string
 */
export function isValidStatusInput(status: unknown): status is string {
    return status !== null &&
        status !== undefined &&
        (typeof status === 'string' || typeof status === 'number');
}
/**
 * Normalize a status string for comparison
 * - Converts to uppercase
 * - Removes extra whitespace
 * - Replaces common separators with spaces
 */
function normalizeStatus(status: string): string {
    return status
        .toString()
        .trim()
        .replace(/[-_]/g, ' ')
        .replace(/\s+/g, ' ')
        .toUpperCase();
}
/**
 * Check if a status matches any variant in a list
 */
function matchesAnyVariant(normalizedStatus: string, variants: readonly string[]): boolean {
    return variants.some(variant => {
        const normalizedVariant = normalizeStatus(variant);
        // Exact match
        if (normalizedStatus === normalizedVariant)
            return true;
        // Check if status contains the variant (but not as substring of another word)
        const regex = new RegExp(`\\b${normalizedVariant}\\b`, 'i');
        return regex.test(normalizedStatus);
    });
}
/**
 * Universal status mapping function - THE PRIMARY FUNCTION TO USE
 *
 * @param status - The status to map (can be any type)
 * @param provider - Optional provider name for provider-specific mappings
 * @returns The mapped MangaPublicationStatus enum value
 *
 * @example
 * ```typescript
 * // Generic mapping
 * const status = mapToMangaStatus('publishing'); // Returns ONGOING
 *
 * // Provider-specific mapping
 * const status = mapToMangaStatus('RELEASING', 'anilist'); // Returns ONGOING
 * ```
 */
export function mapToMangaStatus(status: unknown, provider?: string): MangaPublicationStatus {
    // Type guard and validation
    if (!isValidStatusInput(status)) {
        return MangaPublicationStatus.UNKNOWN;
    }
    const statusStr = String(status);
    // Try provider-specific mapping first if provider is specified
    if (provider && provider in PROVIDER_STATUS_MAP) {
        const providerMap = PROVIDER_STATUS_MAP[provider as keyof typeof PROVIDER_STATUS_MAP];
        // Try exact match first (case-sensitive for provider-specific)
        if (statusStr in providerMap) {
            return providerMap[statusStr as keyof typeof providerMap];
        }
        // Try case-insensitive match
        const normalizedForProvider = normalizeStatus(statusStr);
        for (const [key, value] of Object.entries(providerMap)) {
            if (normalizeStatus(key) === normalizedForProvider) {
                return value;
            }
        }
    }
    // Fall back to generic mapping
    const normalized = normalizeStatus(statusStr);
    // Check against known status variants
    if (matchesAnyVariant(normalized, KNOWN_STATUS_STRINGS.ONGOING)) {
        return MangaPublicationStatus.ONGOING;
    }
    if (matchesAnyVariant(normalized, KNOWN_STATUS_STRINGS.COMPLETED)) {
        return MangaPublicationStatus.COMPLETED;
    }
    if (matchesAnyVariant(normalized, KNOWN_STATUS_STRINGS.HIATUS)) {
        return MangaPublicationStatus.HIATUS;
    }
    if (matchesAnyVariant(normalized, KNOWN_STATUS_STRINGS.CANCELLED)) {
        return MangaPublicationStatus.CANCELLED;
    }
    if (matchesAnyVariant(normalized, KNOWN_STATUS_STRINGS.UPCOMING)) {
        return MangaPublicationStatus.UPCOMING;
    }
    // Default fallback
    return MangaPublicationStatus.UNKNOWN;
}
/**
 * Map domain status back to provider-specific format
 *
 * @param status - The MangaPublicationStatus to convert
 * @param provider - The target provider
 * @returns The provider-specific status string
 */
export function mapFromMangaStatus(status: MangaPublicationStatus, provider: string): string {
    const providerKey = provider.toLowerCase();
    const providerMap = REVERSE_PROVIDER_STATUS_MAP[providerKey];

    // If provider exists in map, try to get the mapped status
    if (providerMap !== undefined) {
        const mappedStatus = providerMap[status];
        if (mappedStatus !== undefined) {
            return mappedStatus;
        }
    }

    // Return the enum value as-is for unknown providers or unmapped statuses
    return status;
}
/**
 * Map chapter status strings to ChapterStatus enum
 *
 * @param status - The chapter status string
 * @returns The mapped ChapterStatus enum value
 */
export function mapToChapterStatus(status: unknown): ChapterStatus {
    if (!isValidStatusInput(status)) {
        return ChapterStatus.PENDING;
    }
    const normalized = normalizeStatus(String(status));
    // Chapter-specific status mappings
    const chapterStatusMap: Record<string, ChapterStatus> = {
        'PENDING': ChapterStatus.PENDING,
        'WAITING': ChapterStatus.PENDING,
        'QUEUED': ChapterStatus.PENDING,
        'DOWNLOADING': ChapterStatus.DOWNLOADING,
        'IN PROGRESS': ChapterStatus.DOWNLOADING,
        'FETCHING': ChapterStatus.DOWNLOADING,
        'COMPLETED': ChapterStatus.COMPLETED,
        'DONE': ChapterStatus.COMPLETED,
        'FINISHED': ChapterStatus.COMPLETED,
        'ERROR': ChapterStatus.ERROR,
        'FAILED': ChapterStatus.ERROR,
        'FAILURE': ChapterStatus.ERROR,
        'DELETED': ChapterStatus.DELETED,
        'REMOVED': ChapterStatus.DELETED,
        'MISSING': ChapterStatus.DELETED
    };
    // Try exact match
    if (normalized in chapterStatusMap) {
        const status = chapterStatusMap[normalized];
        if (status !== undefined) {
            return status;
        }
    }
    // Try partial matches
    for (const [key, value] of Object.entries(chapterStatusMap)) {
        if (normalized.includes(key) || key.includes(normalized)) {
            return value;
        }
    }
    return ChapterStatus.PENDING;
}
/**
 * Batch map multiple statuses
 *
 * @param statuses - Array of statuses to map
 * @param provider - Optional provider for all statuses
 * @returns Array of mapped statuses
 */
export function mapMultipleStatuses(statuses: unknown[], provider?: string): MangaPublicationStatus[] {
    return statuses.map(status => mapToMangaStatus(status, provider));
}
/**
 * Get all valid status strings for a given MangaPublicationStatus
 * Useful for building search queries or filters
 *
 * @param status - The MangaPublicationStatus enum value
 * @returns Array of all known string variations for this status
 */
export function getStatusVariants(status: MangaPublicationStatus): string[] {
    switch (status) {
        case MangaPublicationStatus.ONGOING:
            return [...KNOWN_STATUS_STRINGS.ONGOING];
        case MangaPublicationStatus.COMPLETED:
            return [...KNOWN_STATUS_STRINGS.COMPLETED];
        case MangaPublicationStatus.HIATUS:
            return [...KNOWN_STATUS_STRINGS.HIATUS];
        case MangaPublicationStatus.CANCELLED:
            return [...KNOWN_STATUS_STRINGS.CANCELLED];
        case MangaPublicationStatus.UPCOMING:
            return [...KNOWN_STATUS_STRINGS.UPCOMING];
        default:
            return [...KNOWN_STATUS_STRINGS.UNKNOWN];
    }
}
// Export all individual functions from the old status-mapping.ts for backwards compatibility
// These are deprecated and will be removed in a future version
/**
 * @deprecated Use mapToMangaStatus() instead
 */
export function stringToDomainStatus(status: string): MangaPublicationStatus {
    logger.warn('stringToDomainStatus is deprecated. Use mapToMangaStatus() instead.');
    return mapToMangaStatus(status);
}
/**
 * @deprecated Use mapToMangaStatus(status, 'anilist') instead
 */
export function anilistToDomainStatus(status: string): MangaPublicationStatus {
    logger.warn('anilistToDomainStatus is deprecated. Use mapToMangaStatus(status, "anilist") instead.');
    return mapToMangaStatus(status, 'anilist');
}
/**
 * @deprecated Use mapToMangaStatus(status, 'comicvine') instead
 */
export function comicvineToDomainStatus(status: string): MangaPublicationStatus {
    logger.warn('comicvineToDomainStatus is deprecated. Use mapToMangaStatus(status, "comicvine") instead.');
    return mapToMangaStatus(status, 'comicvine');
}
/**
 * @deprecated Use mapToMangaStatus(status, 'fandom') instead
 */
export function fandomToDomainStatus(status: string): MangaPublicationStatus {
    logger.warn('fandomToDomainStatus is deprecated. Use mapToMangaStatus(status, "fandom") instead.');
    return mapToMangaStatus(status, 'fandom');
}
/**
 * @deprecated Use mapFromMangaStatus() instead
 */
export function domainToProviderStatus(status: MangaPublicationStatus, provider: string): string {
    logger.warn('domainToProviderStatus is deprecated. Use mapFromMangaStatus() instead.');
    return mapFromMangaStatus(status, provider);
}
