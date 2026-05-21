/**
 * Type definitions for ScanItemDetailView
 */

import type { ScanItemSummary } from '../ScanResultsPanel';

/**
 * File info from directory listing with match status
 */
export interface FileInfo {
  name: string;
  path: string;
  size: number;
  detectedChapter: number | undefined;
  detectedVolume: number | undefined;
  matchedChapter: number | undefined;
  matchedVolume: number | undefined;
  matchStatus: 'auto' | 'manual' | 'unmatched';
}

/**
 * Search result from metadata providers
 */
export interface SearchResult {
  id: string | number;
  title: string;
  alternativeTitles: string[] | undefined;
  coverImage: string | undefined;
  description: string | undefined;
  status: string | undefined;
  year: number | undefined;
  provider: string;
  chapters: number | undefined;
  volumes: number | undefined;
}

/**
 * Selected metadata for import
 */
export interface SelectedMetadata {
  id: string | number;
  title: string;
  provider: string;
  coverImage: string | undefined;
  anilistId?: number;
}

/**
 * Props for ScanItemDetailView
 */
export interface ScanItemDetailViewProps {
  opened: boolean;
  onClose: () => void;
  item: ScanItemSummary | null;
  libraryId: number;
  /** Called when import completes successfully with the new manga ID */
  onImportComplete: (mangaId: number, title: string) => void;
}

/**
 * Match statistics for file matching
 */
export interface MatchStats {
  auto: number;
  manual: number;
  unmatched: number;
  total: number;
  matched: number;
}

/**
 * Selected source with provider info
 */
export interface SelectedSourceInfo {
  provider: string;
  result: SearchResult;
  isPrimary: boolean;
}
