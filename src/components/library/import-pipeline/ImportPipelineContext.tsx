/**
 * Import Pipeline Context
 *
 * Provides shared state for the import pipeline using React Context + useReducer.
 * Integrates with existing tRPC endpoints for database operations.
 *
 * @module components/library/import-pipeline/ImportPipelineContext
 */

import {
  createContext,
  useContext,
  useReducer,
  useMemo,
  type ReactNode,
  type Dispatch,
} from 'react';

import { pipelineReducer, initialPipelineState } from './reducer';

import type {
  ImportPipelineState,
  PipelineAction,
  PipelineStage,
  MatchFilter,
  ImportOptions,
  PipelineError,
  FileToChapterMapping,
} from './types';

// ============================================================================
// Context Value Type
// ============================================================================

export interface ImportPipelineContextValue {
  state: ImportPipelineState;
  dispatch: Dispatch<PipelineAction>;

  // Computed values
  canProceedToDetectMatch: boolean;
  canProceedToReview: boolean;
  canProceedToImport: boolean;
}

// ============================================================================
// Context
// ============================================================================

const ImportPipelineContext = createContext<ImportPipelineContextValue | null>(null);

// ============================================================================
// Provider
// ============================================================================

interface ImportPipelineProviderProps {
  children: ReactNode;
}

export function ImportPipelineProvider({ children }: ImportPipelineProviderProps): JSX.Element {
  const [state, dispatch] = useReducer(pipelineReducer, initialPipelineState);

  // Computed: Can proceed to detect+match stage (has library + path)
  const canProceedToDetectMatch = useMemo(
    () => state.selectedLibraryId !== null && state.scanPath.trim().length > 0,
    [state.selectedLibraryId, state.scanPath]
  );

  // Computed: Can proceed to review stage (has at least one matched item)
  const canProceedToReview = useMemo(() => {
    let hasImportable = false;
    state.matchedItems.forEach((item) => {
      if (['matched', 'manual', 'skipped'].includes(item.status)) {
        hasImportable = true;
      }
    });
    return hasImportable;
  }, [state.matchedItems]);

  // Computed: Can proceed to import stage (has items selected for import)
  const canProceedToImport = useMemo(
    () => state.selectedForImport.size > 0,
    [state.selectedForImport]
  );

  const value = useMemo<ImportPipelineContextValue>(
    () => ({
      state,
      dispatch,
      canProceedToDetectMatch,
      canProceedToReview,
      canProceedToImport,
    }),
    [state, canProceedToDetectMatch, canProceedToReview, canProceedToImport]
  );

  return (
    <ImportPipelineContext.Provider value={value}>
      {children}
    </ImportPipelineContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook to access the import pipeline context
 */
export function useImportPipelineContext(): ImportPipelineContextValue {
  const context = useContext(ImportPipelineContext);
  if (!context) {
    throw new Error('useImportPipelineContext must be used within ImportPipelineProvider');
  }
  return context;
}

// ============================================================================
// Action Helpers (for components that don't need full dispatch)
// ============================================================================

/**
 * Create action helper functions from dispatch
 */
export function createPipelineActions(dispatch: Dispatch<PipelineAction>): {
  goToStage: (stage: PipelineStage) => void;
  nextStage: () => void;
  prevStage: () => void;
  reset: () => void;
  setLibrary: (libraryId: number) => void;
  setScanPath: (path: string) => void;
  setActiveFilter: (filter: MatchFilter) => void;
  selectForImport: (itemId: string) => void;
  deselectForImport: (itemId: string) => void;
  selectAllForImport: () => void;
  deselectAllForImport: () => void;
  setImportOptions: (options: Partial<ImportOptions>) => void;
  setItemChapterMappings: (itemId: string, mappings: Map<string, FileToChapterMapping>) => void;
  startImport: () => void;
  cancelImport: () => void;
  addError: (error: Omit<PipelineError, 'timestamp'>) => void;
  clearErrors: () => void;
} {
  return {
    goToStage: (stage) => dispatch({ type: 'GO_TO_STAGE', stage }),
    nextStage: () => dispatch({ type: 'NEXT_STAGE' }),
    prevStage: () => dispatch({ type: 'PREV_STAGE' }),
    reset: () => dispatch({ type: 'RESET' }),
    setLibrary: (libraryId) => dispatch({ type: 'SET_LIBRARY', libraryId }),
    setScanPath: (path) => dispatch({ type: 'SET_SCAN_PATH', path }),
    setActiveFilter: (filter) => dispatch({ type: 'SET_ACTIVE_FILTER', filter }),
    selectForImport: (itemId) => dispatch({ type: 'SELECT_FOR_IMPORT', itemId }),
    deselectForImport: (itemId) => dispatch({ type: 'DESELECT_FOR_IMPORT', itemId }),
    selectAllForImport: () => dispatch({ type: 'SELECT_ALL_FOR_IMPORT' }),
    deselectAllForImport: () => dispatch({ type: 'DESELECT_ALL_FOR_IMPORT' }),
    setImportOptions: (options) => dispatch({ type: 'SET_IMPORT_OPTIONS', options }),
    setItemChapterMappings: (itemId, mappings) => dispatch({ type: 'SET_ITEM_CHAPTER_MAPPINGS', itemId, mappings }),
    startImport: () => dispatch({ type: 'START_IMPORT' }),
    cancelImport: () => dispatch({ type: 'CANCEL_IMPORT' }),
    addError: (error) => dispatch({ type: 'ADD_ERROR', error: { ...error, timestamp: Date.now() } }),
    clearErrors: () => dispatch({ type: 'CLEAR_ERRORS' }),
  };
}
