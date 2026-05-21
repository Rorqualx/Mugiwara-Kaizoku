/**
 * Scanner Type Definitions
 *
 * Shared type definitions for all scanner modules.
 * Extracted from scanner.ts (lines 28-102)
 */

import type { ImportActions, ImportRule } from '@/types/import-rules';
import type { ParsedMangaInfo } from '@/utils/parsers/mangaFileParser';

import type { EnrichmentResult } from '../metadataEnrichmentService';

/**
 * Default subfolder names to exclude from scanning
 * These are common subfolders within manga directories that should not
 * be scanned as separate manga entries
 */
export const DEFAULT_SUBFOLDER_EXCLUSIONS = [
  'Cover Stories',
  'Extras',
  'Specials',
  'Omake',
  'Colored',
  'Raw',
  'Raws',
  '.thumbnails',
  '@eaDir', // Synology NAS metadata
  '.@__thumb', // QNAP NAS metadata
  '__MACOSX', // macOS archive metadata
] as const;

/**
 * Extended parsed manga info with additional metadata fields
 */
export interface ExtendedParsedMangaInfo extends ParsedMangaInfo {
  group?: string;
  language?: string;
  volume?: number;
  chapter?: number;
  chapters?: number[];
}

/**
 * Progress callback function signature
 */
export type ScanProgressCallback = (current: number, total: number, status: string) => void;

/**
 * Enhanced scan options for directory scanning
 */
export interface EnhancedScanOptions {
  path: string;
  targetLibraryId: number;
  options?: {
    autoMatch?: boolean;
    preview?: boolean;
    skipExisting?: boolean;
    parseFileNames?: boolean;
    enrichmentOptions?: {
      providers?: string[];
      provider?: string;
      minConfidence?: number;
      threshold?: number;
      autoSelect?: boolean;
    };
    importRules?: ImportRule[];
    useAdvancedPatterns?: boolean;
    /** Callback for progress updates during scanning */
    onProgress?: ScanProgressCallback;
    /**
     * Subfolder patterns to exclude from scanning
     * These folders within manga directories will not be scanned as separate entries
     * Defaults to DEFAULT_SUBFOLDER_EXCLUSIONS if not specified
     */
    excludeSubfolderPatterns?: string[];
  };
}

/**
 * Result of a scan operation
 */
export interface ScanResult {
  totalFiles: number;
  processed: number;
  created: number;
  skipped: number;
  errors: number;
  items: ScanItem[];
}

/**
 * Individual file info from scan
 */
export interface ScanFileInfo {
  /** File name */
  name: string;
  /** Full file path */
  path: string;
  /** File size in bytes */
  size: number;
  /** Parsed chapter number (if detected) */
  chapterNumber?: number;
  /** Parsed volume number (if detected) */
  volumeNumber?: number;
  /** File extension (cbz, cbr, pdf, etc.) */
  extension: string;
}

/**
 * Individual scan item result
 */
export interface ScanItem {
  path: string;
  parsed: ParsedMangaInfo;
  status: 'created' | 'exists' | 'error' | 'preview' | 'enriched';
  manga?: unknown;
  duplicate?: unknown;
  /** Similarity score when matched to existing manga (0-1) */
  duplicateScore?: number;
  metadata?: unknown;
  enrichment?: EnrichmentResult;
  error?: string;
  chapters?: number;
  /** Total file size in bytes for the manga directory/files */
  fileSize?: number;
  ruleActions?: ImportActions;
  /** List of individual files found in manga directory */
  files?: ScanFileInfo[];
  /** Post-import validation warnings (missing files, count mismatches) */
  validationWarnings?: string[];
}
