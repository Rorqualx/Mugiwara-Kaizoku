/**
 * Batch Metadata Editor - Type Definitions
 *
 * Shared type definitions for the batch metadata editor component.
 * These types define the data structures for manga matching and metadata updates.
 *
 * Extracted from: BatchMetadataEditor.tsx (lines 7-30)
 */

import type { ProviderMatch } from '@/server/services/library/metadataEnrichmentService';

/**
 * Manga entity for metadata matching
 */
export interface MangaForMatching {
  id: number;
  title: string;
  path?: string;
  chaptersCount?: number;
}

/**
 * Metadata update payload
 */
export interface MetadataUpdate {
  mangaId: number;
  provider: string;
  providerId: string;
}

/**
 * Props for BatchMetadataEditor component
 */
export interface BatchMetadataEditorProps {
  manga: MangaForMatching[];
  onSave: (updates: MetadataUpdate[]) => Promise<void>;
  onCancel: () => void;
  fetchMatches: (title: string) => Promise<ProviderMatch[]>;
}

/**
 * State for each manga's match results
 */
export interface MangaMatchState {
  manga: MangaForMatching;
  matches: ProviderMatch[];
  selectedMatchId?: string;
  isLoading: boolean;
  error?: string;
}
