/**
 * Pack Download Type Definitions
 *
 * Types for multi-volume pack downloads and deduplication.
 * Handles tracking of volume packs that span multiple volumes.
 */

/**
 * Pack download record from database
 */
export interface PackDownload {
  id: number;
  releaseTitle: string;
  volumeStart: number | null;
  volumeEnd: number | null;
  mangaId: number;
  jobId: bigint;
  downloadId: string;
  clientType: string;
  indexer: string | null;
  protocol: string;
  status: PackDownloadStatus;
  fileSize: bigint | null;
  filePath: string | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

/**
 * Pack download status
 */
export type PackDownloadStatus =
  | 'DOWNLOADING'  // Pack is currently downloading in client
  | 'COMPLETED'    // Download finished, ready for import
  | 'IMPORTING'    // Extracting and creating chapters
  | 'IMPORTED'     // All chapters created successfully
  | 'FAILED'       // Download or import failed
  | 'CANCELLED';   // Download was cancelled

/**
 * Input for creating a new pack download record
 */
export interface CreatePackDownloadInput {
  releaseTitle: string;
  volumeStart: number | null;
  volumeEnd: number | null;
  mangaId: number;
  jobId: bigint;
  downloadId: string;
  clientType: string;
  indexer?: string;
  protocol?: string;
  fileSize?: bigint;
}

/**
 * Pack download deduplication check result
 */
export interface PackDeduplicationResult {
  isDuplicate: boolean;
  existingPack?: PackDownload;
  reason?: string;
  coveredVolumes?: number[];
}

/**
 * Volume range detected in release title
 */
export interface VolumeRange {
  start: number;
  end: number;
  isSingleVolume: boolean;
}

/**
 * Pack extraction result
 */
export interface PackExtractionResult {
  success: boolean;
  chaptersCreated: number;
  chapterIds: number[];
  errors: string[];
  extractedPath: string;
}

/**
 * Archive file info
 */
export interface ArchiveFileInfo {
  fileName: string;
  filePath: string;
  size: number;
  volumeNumber: number | null;
  chapterNumber: number | null;
  isValidChapter: boolean;
}

/**
 * Pack import options
 */
export interface PackImportOptions {
  packDownloadId: number;
  extractPath: string;
  archivePath: string;
  mangaId: number;
  skipExisting?: boolean;
  dryRun?: boolean;
}

/**
 * Pack import progress
 */
export interface PackImportProgress {
  totalFiles: number;
  processedFiles: number;
  createdChapters: number;
  skippedFiles: number;
  errors: number;
  currentFile: string | null;
}
