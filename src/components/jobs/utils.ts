/**
 * Shared utility functions for task components
 */
import React from 'react';

import { IconRefresh, IconClock, IconAlertCircle, IconCheck, IconCalendar, IconX, IconReload } from '@tabler/icons-react';

import { toJobStatus, toJobType, JobStatus, JobType } from '@/utils/job-validation';
import { mapToMangaStatus } from '@/utils/status-mapper';

/**
 * Get the appropriate color for a task status badge
 * @param status - Task status string or enum value
 * @returns Mantine color string for the badge
 */
export const getStatusColor = (status: string | JobStatus): string => {
    // Convert to standardized TaskStatus enum value
    const jobStatus = typeof status === 'string' ? toJobStatus(status) : status;
    return mapToMangaStatus(jobStatus);
};

/**
 * Get the appropriate icon component for a task type
 * @param type - Task type string or enum value
 * @returns React icon component or null if type is unknown
 */
export const getJobTypeIcon = (type: string | JobType): React.ReactElement | null => {
    // Convert to standardized TaskType enum value
    const jobType = typeof type === 'string' ? toJobType(type) : type;

    // Use string comparison for flexibility with both old and new values
    const typeStr = String(jobType);

    switch (typeStr) {
        case 'CHECK_CHAPTERS':
        case 'CHAPTER_CHECK':
            return React.createElement(IconRefresh, { size: 16 });
        case 'UPDATE_METADATA':
        case 'METADATA_UPDATE':
        case 'METADATA_REFRESH':
        case 'METADATA_SYNC':
            return React.createElement(IconClock, { size: 16 });
        case 'FIX_OUT_OF_SYNC':
        case 'SYNC_FIX':
            return React.createElement(IconAlertCircle, { size: 16 });
        case 'NOTIFY':
            return React.createElement(IconCheck, { size: 16 });
        case 'LIBRARY_SCAN':
        case 'LIBRARY_SYNC':
        case 'LIBRARY_IMPORT':
            return React.createElement(IconRefresh, { size: 16 });
        case 'CHAPTER_DOWNLOAD':
        case 'CHAPTER_SYNC':
            return React.createElement(IconRefresh, { size: 16 });
        case 'BACKUP':
        case 'BACKUP_CREATE':
        case 'BACKUP_RESTORE':
            return React.createElement(IconCheck, { size: 16 });
        default:
            return null;
    }
};

/**
 * Get the appropriate icon for a task status
 * @param status - Task status string or enum value
 * @returns React icon component or null
 */
export const getStatusIcon = (status: string | JobStatus): React.ReactElement | null => {
    const jobStatus = typeof status === 'string' ? toJobStatus(status) : status;
    const statusStr = String(jobStatus);

    switch (statusStr) {
        case 'ACTIVE':
        case 'RUNNING':
            return React.createElement(IconRefresh, { size: 14 });
        case 'COMPLETED':
            return React.createElement(IconCheck, { size: 14 });
        case 'FAILED':
            return React.createElement(IconX, { size: 14 });
        case 'CANCELLED':
            return React.createElement(IconX, { size: 14 });
        case 'SCHEDULED':
        case 'PENDING':
        case 'QUEUED':
            return React.createElement(IconCalendar, { size: 14 });
        case 'RETRYING':
            return React.createElement(IconReload, { size: 14 });
        default:
            return null;
    }
};

/**
 * Format a date for display in task lists
 * @param date - Date to format (Date object or string)
 * @returns Formatted date string
 */
export const formatDate = (date: Date | string | null | undefined): string => {
    if (!date)
        return '-';
    try {
        const dateObj = typeof date === 'string' ? new Date(date) : date;
        return dateObj.toLocaleString();
    }
    catch (_error: unknown) {
        return '-';
    }
};

/**
 * Job entity interface (formerly TaskEntity)
 */
export interface TaskEntity {
    id: number | string | bigint;
    type?: string;
    jobType?: string;
    status: string;
    name?: string | null;
    created_at: Date | string;
    updated_at?: Date | string | null;
    manga?: {
        id: number;
        title: string;
    } | null;
}

/**
 * Gets a task display name
 * @param task - Task entity
 * @returns Display name for the task
 */
export const getTaskDisplayName = (task: TaskEntity): string => {
    // Use jobType if available (new system), fallback to type
    const jobType = (task.jobType ?? task.type) ?? 'unknown';
    return toJobType(jobType);
};

/**
 * Gets a task queue state
 * @param status - Task status
 * @returns Queue state name
 */
export const getQueueState = (status: string | JobStatus): string => {
    const jobStatus = typeof status === 'string' ? toJobStatus(status) : status;
    const statusStr = String(jobStatus);

    switch (statusStr) {
        case 'PENDING':
        case 'QUEUED':
        case 'SCHEDULED':
            return 'queued';
        case 'ACTIVE':
        case 'RUNNING':
        case 'RETRYING':
            return 'active';
        case 'COMPLETED':
            return 'completed';
        case 'FAILED':
            return 'failed';
        case 'CANCELLED':
            return 'cancelled';
        case 'OUT_OF_SYNC':
            return 'out-of-sync';
        default:
            return 'unknown';
    }
};

/**
 * Format a byte count as a human-readable string (e.g. "1.5 GB").
 */
export const formatBytes = (bytes: number): string => {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};

/**
 * Extract a BitTorrent info-hash from a magnet URI.
 * Supports both 40-char hex (v1) and 32-char base32 (v1 alt) info hashes.
 */
export const extractInfoHashFromMagnet = (magnet: string | null | undefined): string | null => {
    if (!magnet) return null;
    const match = /xt=urn:btih:([A-Fa-f0-9]{40}|[A-Z2-7]{32})/i.exec(magnet);
    return match?.[1] ?? null;
};

/**
 * Strip the protocol + host + port from a URL, returning only the path + search.
 * Used to render Prowlarr-proxied torrent download URLs without exposing the
 * caller's internal server address. Returns the original string when parsing fails.
 *
 * Options:
 *  - `redactSecretParams`: drop sensitive query params (apikey/api_key/token/access_token).
 *  - `dropQuery`: drop the entire query string and hash — leaves just the path.
 *    Prefer this for Prowlarr proxy URLs (they pack the full upstream link into `?link=...`,
 *    making the bare path the actual "clean" form for display).
 */
export const stripUrlHost = (
    raw: string | null | undefined,
    options?: { redactSecretParams?: boolean; dropQuery?: boolean },
): string => {
    if (!raw) return '';
    try {
        const u = new URL(raw);
        if (options?.dropQuery) return u.pathname;
        if (options?.redactSecretParams) {
            for (const key of ['apikey', 'api_key', 'token', 'access_token']) {
                u.searchParams.delete(key);
            }
        }
        return `${u.pathname}${u.search}${u.hash}`;
    } catch {
        return raw;
    }
};

/**
 * Build the "original source" URL for a job based on its task type and payload.
 * Returns null when no useful URL can be derived.
 */
export const buildOriginalSourceUrl = (
    taskType: unknown,
    payload: Record<string, unknown> | null,
): string | null => {
    if (!payload) return null;

    const prowlarrResult = payload['prowlarrResult'];
    if (prowlarrResult && typeof prowlarrResult === 'object' && !Array.isArray(prowlarrResult)) {
        const r = prowlarrResult as Record<string, unknown>;
        if (typeof r['infoUrl'] === 'string' && r['infoUrl'].length > 0) return r['infoUrl'];
    }

    if (typeof taskType === 'string') {
        if (taskType === 'mangadex_download') {
            const chapterId = payload['chapterId'];
            if (typeof chapterId === 'string' && chapterId.length > 0) {
                return `https://mangadex.org/chapter/${chapterId}`;
            }
            if (typeof chapterId === 'number') {
                return `https://mangadex.org/chapter/${chapterId}`;
            }
        }
        if (taskType === 'suwayomi_download' || taskType === 'getcomics_download') {
            const url = payload['url'] ?? payload['directUrl'];
            if (typeof url === 'string' && url.length > 0) return url;
        }
    }

    const directUrl = payload['directUrl'];
    if (typeof directUrl === 'string' && directUrl.length > 0) return directUrl;

    return null;
};