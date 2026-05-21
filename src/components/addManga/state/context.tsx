/**
 * Add Manga State Context
 *
 * Provides global state management for the Add Manga workflow
 */
import type { ReactNode} from 'react';
import React, { createContext, useContext, useMemo } from 'react';

import { ErrorBoundary } from '@/components/common/UnifiedErrorBoundary';
import type { MangaSearchResult } from '@/types/search.types';
import { ValidationError } from '@/utils/errors';

import { useAddMangaState, useStatePersistence, useFieldUpdates, useProviderSearches, useMetadataAggregation, useDownloadConfig } from './hooks';

import type { AddMangaState, Selectors } from './types';

interface AddMangaContextValue {
  state: AddMangaState;
  actions: ReturnType<typeof useAddMangaState>['actions'];
  selectors: Selectors;
  fieldUpdates: ReturnType<typeof useFieldUpdates>;
  providerSearches: ReturnType<typeof useProviderSearches>;
  metadataAggregation: ReturnType<typeof useMetadataAggregation>;
  downloadConfig: ReturnType<typeof useDownloadConfig>;
}
const AddMangaContext = createContext<AddMangaContextValue | null>(null);
interface AddMangaProviderProps {
  children: ReactNode;
  initialManga?: MangaSearchResult;
  provider?: string;
  persistKey?: string;
  enablePersistence?: boolean;
  onError?: (error: Error) => void;
}
/**
 * Provider component for Add Manga state
 */
export function AddMangaProvider({ children, initialManga, provider, persistKey = 'addMangaState', enablePersistence = true, onError }: AddMangaProviderProps): React.ReactElement {
  // Initialize core state management
  const { state, actions, selectors, dispatch: _dispatch } = useAddMangaState(initialManga, provider);

  // Enable persistence (called unconditionally to satisfy React Hooks rules)
  useStatePersistence(persistKey, state, actions, enablePersistence);

  // Initialize specialized hooks
  const fieldUpdates = useFieldUpdates(actions);
  const providerSearches = useProviderSearches(state, actions);
  const metadataAggregation = useMetadataAggregation(selectors);
  const downloadConfig = useDownloadConfig(state, actions);
  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo<AddMangaContextValue>(() => ({
    state,
    actions,
    selectors,
    fieldUpdates,
    providerSearches,
    metadataAggregation,
    downloadConfig
  }), [
  state,
  actions,
  selectors,
  fieldUpdates,
  providerSearches,
  metadataAggregation,
  downloadConfig]
  );
  return <ErrorBoundary {...(onError ? { onError } : {})} showDetails={true}>

      <AddMangaContext.Provider value={contextValue}>
        {children}
      </AddMangaContext.Provider>
    </ErrorBoundary>;
}
/**
 * Hook to use Add Manga context
 */
export function useAddMangaContext(): AddMangaContextValue {
  const context = useContext(AddMangaContext);
  if (!context) {
    throw new ValidationError('useAddMangaContext must be used within AddMangaProvider');
  }
  return context;
}
/**
 * Specialized hooks that use the context
 */
/**
 * Hook to access state
 */
export function useAddMangaStateValue(): AddMangaState {
  const { state } = useAddMangaContext();
  return state;
}
/**
 * Hook to access actions
 */
export function useAddMangaActions(): ReturnType<typeof useAddMangaState>['actions'] {
  const { actions } = useAddMangaContext();
  return actions;
}
/**
 * Hook to access selectors
 */
export function useAddMangaSelectors(): Selectors {
  const { selectors } = useAddMangaContext();
  return selectors;
}
/**
 * Hook to access field updates
 */
export function useAddMangaFieldUpdates(): ReturnType<typeof useFieldUpdates> {
  const { fieldUpdates } = useAddMangaContext();
  return fieldUpdates;
}
/**
 * Hook to access provider searches
 */
export function useAddMangaProviderSearches(): ReturnType<typeof useProviderSearches> {
  const { providerSearches } = useAddMangaContext();
  return providerSearches;
}
/**
 * Hook to access metadata aggregation
 */
export function useAddMangaMetadataAggregation(): ReturnType<typeof useMetadataAggregation> {
  const { metadataAggregation } = useAddMangaContext();
  return metadataAggregation;
}
/**
 * Hook to access download config
 */
export function useAddMangaDownloadConfig(): ReturnType<typeof useDownloadConfig> {
  const { downloadConfig } = useAddMangaContext();
  return downloadConfig;
}
/**
 * Hook to access specific field value
 */
export function useFieldValue(fieldName: string): unknown {
  const { selectors } = useAddMangaContext();
  return selectors.getFieldValue(fieldName);
}

/**
 * Return type for useField hook
 */
export interface UseFieldReturn {
  value: unknown;
  source: string | undefined;
  confidence: number | undefined;
  isManuallyEdited: boolean;
  selection: unknown;
}

/**
 * Hook to access specific field with all metadata
 */
export function useField(fieldName: string): UseFieldReturn {
  const { state, selectors } = useAddMangaContext();
  return {
    value: selectors.getFieldValue(fieldName),
    source: selectors.getFieldSource(fieldName),
    confidence: selectors.getFieldConfidence(fieldName),
    isManuallyEdited: selectors.isFieldManuallyEdited(fieldName),
    selection: state.fieldSelections[fieldName]
  };
}
/**
 * Return type for useProviderState hook
 */
export interface UseProviderStateReturn {
  searchStatus: import('@/utils/async-result').AsyncResult<MangaSearchResult[]> | undefined;
  isSearching: boolean;
  hasResults: boolean;
  selectedSource: MangaSearchResult | undefined;
  selectSource: (manga: MangaSearchResult) => void;
  deselectSource: () => void;
}

/**
 * Hook to manage a specific provider's search
 */
export function useProviderState(provider: string): UseProviderStateReturn {
  const { state: _state, selectors, actions } = useAddMangaContext();
  return {
    searchStatus: selectors.getProviderSearchStatus(provider),
    isSearching: selectors.isProviderSearching(provider),
    hasResults: selectors.hasProviderResults(provider),
    selectedSource: selectors.getSelectedSource(provider),
    selectSource: (manga: MangaSearchResult): void => actions.selectSource(provider, manga),
    deselectSource: (): void => actions.deselectSource(provider)
  };
}
/**
 * Return type for useHistory hook
 */
export interface UseHistoryReturn {
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  saveHistory: () => void;
  historyLength: number;
  futureLength: number;
}

/**
 * Hook for undo/redo functionality
 */
export function useHistory(): UseHistoryReturn {
  const { state, actions, selectors } = useAddMangaContext();
  return {
    canUndo: selectors.canUndo(),
    canRedo: selectors.canRedo(),
    undo: actions.undo,
    redo: actions.redo,
    saveHistory: actions.saveHistory,
    historyLength: state.history.past.length,
    futureLength: state.history.future.length
  };
}
/**
 * Return type for useMonitoring hook
 */
export interface UseMonitoringReturn {
  enabled: boolean;
  interval: string;
  setEnabled: (enabled: boolean) => void;
  setInterval: (interval: string) => void;
  toggle: () => void;
}

/**
 * Hook for monitoring configuration
 */
export function useMonitoring(): UseMonitoringReturn {
  const { state, actions } = useAddMangaContext();
  return {
    enabled: state.monitoringEnabled,
    interval: state.monitoringInterval,
    setEnabled: actions.setMonitoringEnabled,
    setInterval: actions.setMonitoringInterval,
    toggle: (): void => actions.setMonitoringEnabled(!state.monitoringEnabled)
  };
}
/**
 * Return type for useUIState hook
 */
export interface UseUIStateReturn {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  expandedSections: Set<string>;
  toggleSection: (section: string) => void;
  isSectionExpanded: (section: string) => boolean;
  isConfirming: boolean;
  confirmationError: string | null;
  setConfirming: (confirming: boolean) => void;
  setConfirmationError: (error: string | null) => void;
}

/**
 * Hook for UI state management
 */
export function useUIState(): UseUIStateReturn {
  const { state, actions } = useAddMangaContext();
  return {
    activeTab: state.activeTab,
    setActiveTab: actions.setActiveTab,
    expandedSections: state.expandedSections,
    toggleSection: actions.toggleSection,
    isSectionExpanded: (section: string): boolean => state.expandedSections.has(section),
    isConfirming: state.isConfirming,
    confirmationError: state.confirmationError,
    setConfirming: actions.setConfirming,
    setConfirmationError: actions.setConfirmationError
  };
}
/**
 * Return type for useMetadataUrls hook
 */
export interface UseMetadataUrlsReturn {
  urls: string[];
  add: (url: string) => void;
  remove: (url: string) => void;
  clear: () => void;
  count: number;
  hasUrl: (url: string) => boolean;
}

/**
 * Hook for metadata URLs management
 */
export function useMetadataUrls(): UseMetadataUrlsReturn {
  const { state, actions } = useAddMangaContext();
  return {
    urls: state.metadataUrls,
    add: actions.addMetadataUrl,
    remove: actions.removeMetadataUrl,
    clear: actions.clearMetadataUrls,
    count: state.metadataUrls.length,
    hasUrl: (url: string): boolean => state.metadataUrls.includes(url)
  };
}