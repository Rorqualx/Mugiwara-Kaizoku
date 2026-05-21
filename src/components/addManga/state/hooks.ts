/**
 * Custom Hooks for Add Manga State Management
 *
 * Provides hooks for managing the Add Manga workflow state
 *
 * @module components/addManga/state/hooks
 */

import { useReducer, useMemo } from 'react';

import type { MangaSearchResult } from '@/types/search.types';
import { isSuccess, isLoading } from '@/utils/async-result';

import { addMangaReducer, initialState, actions } from './reducer';

import type { AddMangaState, Selectors, FieldSelection, DownloadConfig, AddMangaAction } from './types';

// Re-export hooks from submodules
export { useStatePersistence, useFieldUpdates, useDownloadConfig } from './hooks/utility-hooks';
export { useProviderSearches } from './hooks/search-hooks';
export { useMetadataAggregation } from './hooks/metadata-hooks';

// ============================================================================
// Main State Management Hook
// ============================================================================

/**
 * Main state management hook
 */
export function useAddMangaState(initialManga?: MangaSearchResult, provider?: string): {
  state: AddMangaState;
  actions: {
    initializeState: (newState: Partial<AddMangaState>) => void;
    resetState: () => void;
    updateField: (field: string, selection: FieldSelection) => void;
    updateMultipleFields: (fields: Record<string, FieldSelection>) => void;
    resetField: (field: string) => void;
    startProviderSearch: (provider: string) => void;
    completeProviderSearch: (provider: string, results: MangaSearchResult[]) => void;
    failProviderSearch: (provider: string, error: Error) => void;
    selectSource: (provider: string, manga: MangaSearchResult) => void;
    deselectSource: (provider: string) => void;
    clearSources: () => void;
    updateDownloadConfig: (config: Partial<DownloadConfig>) => void;
    resetDownloadConfig: () => void;
    addMetadataUrl: (url: string) => void;
    removeMetadataUrl: (url: string) => void;
    clearMetadataUrls: () => void;
    setActiveTab: (tab: string) => void;
    toggleSection: (section: string) => void;
    setConfirming: (confirming: boolean) => void;
    setConfirmationError: (error: string | null) => void;
    setMonitoringEnabled: (enabled: boolean) => void;
    setMonitoringInterval: (interval: string) => void;
    undo: () => void;
    redo: () => void;
    saveHistory: () => void;
  };
  selectors: Selectors;
  dispatch: React.Dispatch<AddMangaAction>;
} {
  const [state, dispatch] = useReducer(addMangaReducer, initialState, (initial) => {
    if (initialManga ?? provider) {
      return {
        ...initial,
        originalManga: initialManga ?? null,
        selectedProvider: provider ?? null
      };
    }
    return initial;
  });

  const selectors = useMemo<Selectors>(() => createSelectors(state), [state]);
  const boundActions = useMemo(() => createBoundActions(dispatch), [dispatch]);

  return { state, actions: boundActions, selectors, dispatch };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create memoized selectors from state
 */
function createSelectors(state: AddMangaState): Selectors {
  return {
    getFieldValue: (field: string) => state.fieldSelections[field]?.value,
    getFieldSource: (field: string) => state.fieldSelections[field]?.source,
    getFieldConfidence: (field: string) => state.fieldSelections[field]?.confidence,
    isFieldManuallyEdited: (field: string) => state.fieldSelections[field]?.isManuallyEdited ?? false,
    getProviderSearchStatus: (provider: string) => state.providerSearches[provider],
    isProviderSearching: (provider: string) => {
      const status = state.providerSearches[provider];
      return status ? isLoading(status) : false;
    },
    hasProviderResults: (provider: string) => {
      const status = state.providerSearches[provider];
      return status ? isSuccess(status) && status.data.length > 0 : false;
    },
    getSelectedSource: (provider: string) => state.selectedSources[provider],
    getAllSelectedSources: () => state.selectedSources,
    getMetadataCompleteness: () => {
      const fields = Object.values(state.fieldSelections);
      if (fields.length === 0) return 0;
      const completed = fields.filter((f) => f.value !== null && f.value !== undefined && f.value !== '').length;
      return Math.round(completed / fields.length * 100);
    },
    getOverallConfidence: () => {
      const fields = Object.values(state.fieldSelections);
      const withConfidence = fields.filter((f) => f.confidence !== undefined);
      if (withConfidence.length === 0) return 0;
      const total = withConfidence.reduce((sum, f) => sum + (f.confidence ?? 0), 0);
      return Math.round(total / withConfidence.length);
    },
    canUndo: () => state.history.past.length > 0,
    canRedo: () => state.history.future.length > 0
  };
}

/**
 * Create bound action creators
 */
function createBoundActions(dispatch: React.Dispatch<AddMangaAction>): ReturnType<typeof useAddMangaState>['actions'] {
  return {
    initializeState: (newState: Partial<AddMangaState>) => dispatch(actions.initializeState(newState)),
    resetState: () => dispatch(actions.resetState()),
    updateField: (field: string, selection: FieldSelection) => dispatch(actions.updateField(field, selection)),
    updateMultipleFields: (fields: Record<string, FieldSelection>) => dispatch(actions.updateMultipleFields(fields)),
    resetField: (field: string) => dispatch(actions.resetField(field)),
    startProviderSearch: (provider: string) => dispatch(actions.startProviderSearch(provider)),
    completeProviderSearch: (provider: string, results: MangaSearchResult[]) => dispatch(actions.completeProviderSearch(provider, results)),
    failProviderSearch: (provider: string, error: Error) => dispatch(actions.failProviderSearch(provider, error)),
    selectSource: (provider: string, manga: MangaSearchResult) => dispatch(actions.selectSource(provider, manga)),
    deselectSource: (provider: string) => dispatch(actions.deselectSource(provider)),
    clearSources: () => dispatch(actions.clearSources()),
    updateDownloadConfig: (config: Partial<DownloadConfig>) => dispatch(actions.updateDownloadConfig(config)),
    resetDownloadConfig: () => dispatch(actions.resetDownloadConfig()),
    addMetadataUrl: (url: string) => dispatch(actions.addMetadataUrl(url)),
    removeMetadataUrl: (url: string) => dispatch(actions.removeMetadataUrl(url)),
    clearMetadataUrls: () => dispatch(actions.clearMetadataUrls()),
    setActiveTab: (tab: string) => dispatch(actions.setActiveTab(tab)),
    toggleSection: (section: string) => dispatch(actions.toggleSection(section)),
    setConfirming: (confirming: boolean) => dispatch(actions.setConfirming(confirming)),
    setConfirmationError: (error: string | null) => dispatch(actions.setConfirmationError(error)),
    setMonitoringEnabled: (enabled: boolean) => dispatch(actions.setMonitoringEnabled(enabled)),
    setMonitoringInterval: (interval: string) => dispatch(actions.setMonitoringInterval(interval)),
    undo: () => dispatch(actions.undo()),
    redo: () => dispatch(actions.redo()),
    saveHistory: () => dispatch(actions.saveHistory())
  };
}
