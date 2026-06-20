/**
 * Download Manager Types
 *
 * Shared type definitions and interfaces for download management.
 */

import type { DownloadMethod, DownloadMode, PrismaClient, jobs } from '@prisma/client';

/**
 * Download payload structure for job processing
 */
export interface DownloadPayload {
    method: DownloadMethod;
    mode: DownloadMode;
    chapterIds: number[];
    format?: string;
    quality?: string;
    clientType?: string;
    directUrl?: string;
    prowlarrResult?: unknown;
    /** GetComics detail page URL for DDL downloads */
    getcomicsUrl?: string;
    /** Source identifier (e.g., 'getcomics', 'prowlarr', 'suwayomi') */
    sourceType?: string;
}

/**
 * Manga with title property for type guards
 */
export interface MangaWithTitle {
    title: string;
}

/**
 * Parameters for tracking pack downloads
 */
export interface PackDownloadParams {
    releaseTitle: string;
    mangaId: number;
    jobId: number;
    downloadId: string;
    clientType: string;
    indexer: string | null;
    protocol: string;
    chapterIds: number[];
    fileSize?: number;
    downloadUrl?: string;
    /** Owner of the download; defaults to the initiating job's owner when omitted. */
    initiatedByUserId?: string;
}

/**
 * Result from sending download to client
 */
export interface ClientResult {
    downloadId: string;
    clientType: string;
}

/**
 * Options for sending downloads to clients
 */
export interface SendToClientOptions {
    category?: string;
    destination?: string;
    paused?: boolean;
}

// Re-export Prisma types for convenience
export type { DownloadMethod, DownloadMode, PrismaClient, jobs };
