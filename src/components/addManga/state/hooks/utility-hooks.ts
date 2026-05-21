/**
 * Add Manga State - Utility Hooks
 *
 * Contains useStatePersistence, useFieldUpdates, and useDownloadConfig hooks.
 *
 * @module components/addManga/state/hooks/utility-hooks
 */

import { useCallback, useEffect, useRef } from 'react';

import { logger } from '@/utils/logger';

import type { useAddMangaState } from '../hooks';
import type { AddMangaState, FieldSelection, DownloadConfig } from '../types';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse saved state from localStorage
 */
function parseSavedState(savedState: string): Partial<AddMangaState> | null {
  try {
    const parsed: unknown = JSON.parse(savedState);
    if (!parsed || typeof parsed !== 'object' || !('expandedSections' in parsed)) {
      return null;
    }

    const typedParsed = parsed as Record<string, unknown>;
    if (Array.isArray(typedParsed['expandedSections'])) {
      typedParsed['expandedSections'] = new Set(typedParsed['expandedSections']);
    }
    return typedParsed as Partial<AddMangaState>;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to load persisted state:', errorMessage);
    return null;
  }
}

/**
 * Prepare state for saving to localStorage
 */
function prepareStateForSaving(state: AddMangaState): Record<string, unknown> {
  return {
    ...state,
    expandedSections: Array.from(state.expandedSections),
    providerSearches: {},
    enhancementStatus: {},
    history: { past: [], future: [] }
  };
}

// ============================================================================
// State Persistence Hook
// ============================================================================

/**
 * Hook for persisting state to localStorage
 */
export function useStatePersistence(
  key: string,
  state: AddMangaState,
  actions: ReturnType<typeof useAddMangaState>['actions'],
  enabled = true
): void {
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (!enabled || !isFirstRender.current) return;
    isFirstRender.current = false;

    const savedState = localStorage.getItem(key);
    if (!savedState) return;

    const parsed = parseSavedState(savedState);
    if (parsed) {
      actions.initializeState(parsed);
    }
  }, [key, actions, enabled]);

  useEffect(() => {
    if (!enabled || isFirstRender.current) return;

    try {
      localStorage.setItem(key, JSON.stringify(prepareStateForSaving(state)));
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to persist state:', errorMessage);
    }
  }, [key, state, enabled]);
}

// ============================================================================
// Field Updates Hook
// ============================================================================

/**
 * Hook for managing field updates with debouncing
 */
export function useFieldUpdates(
  actions: ReturnType<typeof useAddMangaState>['actions'],
  debounceMs = 300
): {
  updateField: (field: string, value: unknown, source: string, confidence?: number) => void;
  updateFieldImmediate: (field: string, value: unknown, source: string, confidence?: number) => void;
  updateMultipleFields: (updates: Record<string, FieldSelection>) => void;
} {
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const updateField = useCallback((field: string, value: unknown, source: string, confidence?: number) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(() => {
      actions.updateField(field, {
        value,
        source,
        ...(confidence !== undefined ? { confidence } : {}),
        isManuallyEdited: source === 'manual'
      });
    }, debounceMs);
  }, [actions, debounceMs]);

  const updateFieldImmediate = useCallback((field: string, value: unknown, source: string, confidence?: number) => {
    actions.updateField(field, {
      value,
      source,
      ...(confidence !== undefined ? { confidence } : {}),
      isManuallyEdited: source === 'manual'
    });
  }, [actions]);

  const updateMultipleFields = useCallback((updates: Record<string, FieldSelection>) => {
    actions.updateMultipleFields(updates);
  }, [actions]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return { updateField, updateFieldImmediate, updateMultipleFields };
}

// ============================================================================
// Download Config Hook
// ============================================================================

/**
 * Hook for managing download configuration
 */
export function useDownloadConfig(
  state: AddMangaState,
  actions: ReturnType<typeof useAddMangaState>['actions']
): {
  config: DownloadConfig;
  updateConfig: (updates: Partial<DownloadConfig>) => void;
  toggleAutoDownload: () => void;
  setChapterRange: (start: number, end?: number) => void;
  resetConfig: () => void;
} {
  const updateConfig = useCallback((updates: Partial<DownloadConfig>) => {
    actions.updateDownloadConfig(updates);
  }, [actions]);

  const toggleAutoDownload = useCallback(() => {
    actions.updateDownloadConfig({ autoDownload: !state.downloadConfig.autoDownload });
  }, [state.downloadConfig.autoDownload, actions]);

  const setChapterRange = useCallback((start: number, end?: number) => {
    actions.updateDownloadConfig({
      startChapter: start,
      ...(end !== undefined ? { endChapter: end } : {})
    });
  }, [actions]);

  const resetConfig = useCallback(() => {
    actions.resetDownloadConfig();
  }, [actions]);

  return { config: state.downloadConfig, updateConfig, toggleAutoDownload, setChapterRange, resetConfig };
}
