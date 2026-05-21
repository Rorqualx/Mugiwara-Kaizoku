/**
 * File Importer Types
 *
 * Shared type definitions for the file importer service modules.
 * Provides common interfaces for import operations and results.
 */

export type { CompletedDownload } from '../downloadMonitor';

/**
 * Result of file import operation
 */
export interface ImportResult {
  mangaId: number;
  mangaTitle: string;
  filesImported: number;
  chaptersUpdated: number;
  files: {
    fileName: string;
    filePath: string;
    chapterId?: number;
    chapterNumber?: number;
    size: number;
  }[];
  errors: string[];
}
