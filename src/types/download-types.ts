/**
 * Download-related types
 * Uses Prisma types as the single source of truth
 */

import { 
  DownloadMethod, 
  DownloadStatus, 
  DownloadMode 
} from '@prisma/client';

export { 
  DownloadMethod, 
  DownloadStatus, 
  DownloadMode 
};

export interface DownloadRequest {
  mangaId: number;
  chapterIds: number[];
  method: DownloadMethod;
  mode: DownloadMode;
  clientType?: string;
  directUrl?: string;
  prowlarrResult?: unknown;
  getcomicsUrl?: string; // GetComics detail page URL for DDL downloads
  format?: string;
  quality?: string;
  priority?: number;
  chapterId?: number; // Optional chapter ID for single-chapter downloads
  initiatedByUserId?: string; // User who initiated — stamped on the job for per-user scoping
}

export function isValidDownloadRequest(request: unknown): request is DownloadRequest {
  if (!request || typeof request !== 'object') {
    return false;
  }

  const req = request as Record<string, unknown>;

  return (
    typeof req['mangaId'] === 'number' &&
    Array.isArray(req['chapterIds']) &&
    req['chapterIds'].length > 0 &&
    Object.values(DownloadMethod).includes(req['method'] as DownloadMethod) &&
    Object.values(DownloadMode).includes(req['mode'] as DownloadMode)
  );
}

/**
 * Manual import file mapping
 */
export interface ManualImportFileMapping {
  sourcePath: string;
  chapterId: number;
  chapterNumber?: number;
  fileName: string;
}

/**
 * Manual import request
 */
export interface ManualImportRequest {
  jobId: string;
  mangaId: number;
  files: ManualImportFileMapping[];
}

/**
 * Manual import result for a single file
 */
export interface ManualImportFileResult {
  sourcePath: string;
  fileName: string;
  chapterId?: number;
  success: boolean;
  error?: string;
}

/**
 * Manual import overall result
 */
export interface ManualImportResult {
  jobId: string;
  mangaId: number;
  filesProcessed: number;
  filesImported: number;
  filesFailed: number;
  results: ManualImportFileResult[];
}