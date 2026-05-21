/**
 * Status Mapping Utilities
 *
 * Maps provider-specific status strings to standardized MangaPublicationStatus enum.
 * Extracted from metadataService.ts with bug fixes.
 *
 * @module status-mapper
 */

import { MangaPublicationStatus } from '@prisma/client';

/**
 * Map provider status string to standardized publication status
 *
 * Handles various status formats from different metadata providers and
 * normalizes them to the MangaPublicationStatus enum.
 *
 * @param status - Status string from provider (case-insensitive)
 * @returns Standardized MangaPublicationStatus
 *
 * @example
 * ```typescript
 * mapProviderStatus('Ongoing') // MangaPublicationStatus.ONGOING
 * mapProviderStatus('COMPLETED') // MangaPublicationStatus.COMPLETED
 * mapProviderStatus('Publishing') // MangaPublicationStatus.ONGOING
 * ```
 */
export function mapProviderStatus(status: string): MangaPublicationStatus {
    const upperStatus = status.toUpperCase();

    // Check for ongoing/publishing status
    if (
        upperStatus.includes('ONGOING') ||
        upperStatus.includes('RELEASING') ||
        upperStatus.includes('PUBLISHING')
    ) {
        return MangaPublicationStatus.ONGOING;
    }

    // Check for completed/finished status
    if (
        upperStatus.includes('COMPLETED') ||
        upperStatus.includes('FINISHED') ||
        upperStatus.includes('ENDED')
    ) {
        return MangaPublicationStatus.COMPLETED;
    }

    // Check for cancelled status
    if (upperStatus.includes('CANCELLED') || upperStatus.includes('CANCELED')) {
        return MangaPublicationStatus.CANCELLED;
    }

    // Check for hiatus/paused status
    if (upperStatus.includes('HIATUS') || upperStatus.includes('PAUSED')) {
        return MangaPublicationStatus.HIATUS;
    }

    return MangaPublicationStatus.UNKNOWN;
}
