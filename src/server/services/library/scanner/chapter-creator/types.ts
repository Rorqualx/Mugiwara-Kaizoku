/**
 * Chapter Creator Types Module
 *
 * Shared types for chapter creation and file linking.
 *
 * @module server/services/library/scanner/chapter-creator/types
 */

import type { ChapterStatus } from '@prisma/client';

/** Chapter mapping from import pipeline (user-assigned volume/chapter info) */
export interface ChapterMappingForImport {
  filePath: string;
  chapterNumber?: number;
  volumeNumber?: number;
  title?: string;
  /** For volume files: first chapter number in the volume */
  chapterRangeStart?: number;
  /** For volume files: last chapter number in the volume */
  chapterRangeEnd?: number;
  /** Page count from metadata (for validation) */
  pageCount?: number;
  /** Cover image URL from metadata */
  coverImage?: string;
  /** Chapter description/summary from metadata */
  description?: string;
  /** Release date from metadata */
  releaseDate?: string;
  /** URL to chapter page on wiki/source */
  sourceUrl?: string;
}

export interface ParsedFileInfo {
  file: string;
  fileName: string;
  chapterNumber: number | null;
  volumeNumber: number | null;
  title: string;
  size: number;
  isVolumeFile: boolean;
}

export interface LinkFilesResult {
  linked: number;
  created: number;
}

export interface ChapterInfo {
  id: number;
  volume: number | null;
}

export interface ChapterUpdate {
  id: number;
  fileName: string;
  filePath: string;
  size: number;
  /** Chapter title from metadata (only applied if more specific than existing) */
  title?: string | undefined;
  /** Cover image URL from metadata */
  coverImage?: string | undefined;
  /** Chapter description/summary from metadata */
  description?: string | undefined;
  /** Page count from metadata */
  pageCount?: number | undefined;
  /** Release date from metadata */
  releaseDate?: Date | undefined;
}

export interface ChapterCreate {
  mangaId: number;
  fileName: string;
  filePath: string;
  /** Normalized container format (cbz/cbr/pdf/...) for the auto-conversion sweep. */
  fileFormat?: string | null;
  index: number;
  title: string;
  size: number;
  downloadStatus: ChapterStatus;
  volume: number | null;
  updatedAt: Date;
  /** Cover image URL from metadata */
  coverImage?: string;
  /** Chapter description/summary from metadata */
  description?: string;
  /** Page count from metadata */
  pageCount?: number;
  /** Release date from metadata */
  releaseDate?: Date;
  /** Chapter number (decimal support for 10.5 etc.) */
  chapterNumber?: number;
}

/** Data needed to create a ChapterFile entry alongside chapter create/update */
export interface ChapterFileCreate {
  filePath: string;
  fileName: string;
  fileSize: number;
  sourceType: 'chapter' | 'volume';
  /** Whether this is a volume file (multiple chapters share it) */
  isVolumeFile: boolean;
}
