/**
 * MangaDetailView State Management Hook
 *
 * Custom React hook that manages all state for the MangaDetailView component.
 * Provides centralized state management for UI toggles, conflicts data, and
 * related handlers.
 *
 * Features:
 * - Description expand/collapse state
 * - Synonyms/alternative titles expand/collapse state
 * - Conflict resolution modal state
 * - Metadata conflicts state with AsyncResult pattern
 * - Mock conflicts query (to be replaced with actual tRPC query)
 *
 * Returns: MangaDetailState interface with all state and handlers
 *
 * Extracted from: MangaDetailView.tsx (lines 124-211)
 */

import { useState, useEffect } from 'react';

import type { MetadataConflict } from '@/types/metadata-types';
import type { AsyncResult } from '@/utils/async-result';
import {
  createIdleResult,
  createSuccessResult,
  isSuccess
} from '@/utils/async-result';

import type { MangaDetailState } from './MangaDetailTypes';

/**
 * Custom hook for managing MangaDetailView state
 *
 * @param onRefreshMetadata - Optional callback to refresh metadata after conflicts resolved
 * @returns MangaDetailState with all state values and handlers
 */
export function useMangaDetailState(
  onRefreshMetadata?: () => void
): MangaDetailState {
  // UI state - expand/collapse toggles
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isSynonymsExpanded, setIsSynonymsExpanded] = useState(false);
  const [isConflictModalOpen, setIsConflictModalOpen] = useState(false);

  // Conflicts state with AsyncResult pattern
  const [conflictsState, setConflictsState] = useState<
    AsyncResult<MetadataConflict[], Error>
  >(createIdleResult());

  // Mock conflicts query - TODO: Replace with actual tRPC query
  // Note: This is a static mock that always returns empty data
  const refetchConflicts = (): void => {
    // Mock implementation - no-op for now
  };

  // Initialize conflicts state with empty data (mock)
  // TODO: Replace with actual tRPC query when available
  useEffect(() => {
    // Mock always returns empty conflicts
    setConflictsState(createSuccessResult<MetadataConflict[], Error>([]));
  }, []);

  /**
   * Handle conflicts resolved event
   * Refetches conflicts and triggers metadata refresh if callback provided
   */
  const handleConflictsResolved = (): void => {
    refetchConflicts();
    onRefreshMetadata?.();
  };

  // Calculate conflicts count safely using AsyncResult pattern
  const conflictsCount = isSuccess(conflictsState)
    ? conflictsState.data.length
    : 0;

  // Return all state and handlers
  return {
    isDescriptionExpanded,
    setIsDescriptionExpanded,
    isSynonymsExpanded,
    setIsSynonymsExpanded,
    isConflictModalOpen,
    setIsConflictModalOpen,
    conflictsState,
    conflictsCount,
    handleConflictsResolved
  };
}
