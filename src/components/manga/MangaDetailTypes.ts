/**
 * MangaDetailView Type Definitions
 *
 * Shared type definitions and interfaces used across all MangaDetailView
 * sub-components. This foundation module is imported by all other modules
 * to ensure type consistency.
 *
 * Exports:
 * - MangaDetailViewProps: Main component props
 * - MangaDetailState: State management hook return type
 * - MangaDetailLoadingStateProps: Loading component props
 * - MangaDetailErrorStateProps: Error component props
 * - MangaBannerSectionProps: Banner component props
 *
 * Extracted from: MangaDetailView.tsx (lines 79-86 + additional types)
 *
 * @module MangaDetailTypes
 */

// ============================================================================
// External Imports
// ============================================================================

import type { MetadataConflict } from '@/types/metadata-types';
import type { MangaWithRelations, ID } from '@/types/search.types';
import type { AsyncResult } from '@/utils/async-result';

// ============================================================================
// Main Component Props
// ============================================================================

/**
 * Props for MangaDetailView main component
 *
 * @property mangaResult - AsyncResult containing manga data with all relations
 * @property onToggleMonitoring - Optional callback when chapter monitoring is toggled
 * @property onAutoSearch - Optional callback to trigger automatic search for a chapter
 * @property onManualSearch - Optional callback to trigger manual search for a chapter
 * @property onRefreshMetadata - Optional callback to refresh manga metadata
 * @property className - Optional CSS class name for styling
 */
export interface MangaDetailViewProps {
  mangaResult: AsyncResult<MangaWithRelations, Error>;
  onToggleMonitoring?: (chapterId: ID, monitored: boolean) => void;
  onAutoSearch?: (chapterId: ID) => void;
  onManualSearch?: (chapterId: ID) => void;
  onRefreshMetadata?: () => void;
  className?: string;
}

// ============================================================================
// State Management Types
// ============================================================================

/**
 * Return type for useMangaDetailState hook
 *
 * Manages all UI state for the MangaDetailView component including
 * description expansion, synonyms visibility, conflict modal state,
 * and metadata conflicts.
 *
 * @property isDescriptionExpanded - Whether the description text is expanded
 * @property setIsDescriptionExpanded - Set description expansion state
 * @property isSynonymsExpanded - Whether the alternative titles list is expanded
 * @property setIsSynonymsExpanded - Set synonyms expansion state
 * @property isConflictModalOpen - Whether the conflict resolution modal is open
 * @property setIsConflictModalOpen - Set conflict modal open state
 * @property conflictsState - AsyncResult containing metadata conflicts
 * @property conflictsCount - Number of detected metadata conflicts
 * @property handleConflictsResolved - Callback when conflicts are resolved
 */
export interface MangaDetailState {
  isDescriptionExpanded: boolean;
  setIsDescriptionExpanded: (value: boolean) => void;
  isSynonymsExpanded: boolean;
  setIsSynonymsExpanded: (value: boolean) => void;
  isConflictModalOpen: boolean;
  setIsConflictModalOpen: (value: boolean) => void;
  conflictsState: AsyncResult<MetadataConflict[], Error>;
  conflictsCount: number;
  handleConflictsResolved: () => void;
}

// ============================================================================
// Sub-Component Props
// ============================================================================

/**
 * Props for MangaDetailLoadingState component
 *
 * Displays a loading overlay while manga data is being fetched.
 *
 * @property className - Optional CSS class name for styling
 */
export interface MangaDetailLoadingStateProps {
  className?: string;
}

/**
 * Props for MangaDetailErrorState component
 *
 * Displays an error message when manga data fails to load,
 * with optional retry functionality.
 *
 * @property error - Error object or unknown error value
 * @property onRefreshMetadata - Optional callback to retry loading
 * @property className - Optional CSS class name for styling
 */
export interface MangaDetailErrorStateProps {
  error: Error | unknown;
  onRefreshMetadata?: () => void;
  className?: string;
}

/**
 * Props for MangaBannerSection component
 *
 * Displays the manga banner with cover image, title, metadata badges,
 * and primary information.
 *
 * @property manga - Manga data with all relations
 * @property mangaIdNum - Manga ID as a number for API calls
 * @property state - MangaDetailState containing UI state and handlers
 */
export interface MangaBannerSectionProps {
  manga: MangaWithRelations;
  mangaIdNum: number;
  state: MangaDetailState;
}
