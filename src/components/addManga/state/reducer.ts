/**
 * Add Manga State Reducer
 * 
 * Handles all state updates for the Add Manga workflow
 */

import type { MangaSearchResult } from '@/types/search.types';
import { 
  
  createLoadingResult, 
  createSuccessResult, 
  createErrorResult 
} from '@/utils/async-result';

import {
  ActionType
} from './types';

import type {
  AddMangaState,
  AddMangaAction,
  DownloadConfig,
  FieldSelection
} from './types';

/**
 * Initial download configuration
 */
const initialDownloadConfig: DownloadConfig = {
  autoDownload: false,
  downloadQuality: 'high',
  startChapter: 1,
  downloadNewChapters: true,
  notifyOnComplete: true,
};

/**
 * Initial state
 */
export const initialState: AddMangaState = {
  originalManga: null,
  selectedProvider: null,
  fieldSelections: {},
  providerSearches: {},
  selectedSources: {},
  downloadConfig: initialDownloadConfig,
  metadataUrls: [],
  activeTab: 'overview',
  expandedSections: new Set(),
  isConfirming: false,
  confirmationError: null,
  monitoringEnabled: false,
  monitoringInterval: 'daily',
  enhancementStatus: {},
  history: {
    past: [],
    future: [],
  },
};

/**
 * Save current state to history
 */
function saveToHistory(state: AddMangaState): AddMangaState {
  const { history, ...stateWithoutHistory } = state;
  return {
    ...state,
    history: {
      past: [...history.past, stateWithoutHistory].slice(-10), // Keep last 10 states
      future: [],
    },
  };
}

/**
 * Main reducer function
 */
// eslint-disable-next-line complexity -- Complex reducer with many action types
export function addMangaReducer(
  state: AddMangaState = initialState,
  action: AddMangaAction
): AddMangaState {
  switch (action.type) {
    // Initial setup
    case ActionType.INITIALIZE_STATE:
      return {
        ...initialState,
        ...action.payload,
      };

    case ActionType.RESET_STATE:
      return initialState;

    // Field updates
    case ActionType.UPDATE_FIELD: {
      const newState = saveToHistory(state);
      return {
        ...newState,
        fieldSelections: {
          ...newState.fieldSelections,
          [action.payload.field]: action.payload.selection,
        },
      };
    }

    case ActionType.UPDATE_MULTIPLE_FIELDS: {
      const newState = saveToHistory(state);
      return {
        ...newState,
        fieldSelections: {
          ...newState.fieldSelections,
          ...action.payload,
        },
      };
    }

    case ActionType.RESET_FIELD: {
      const { [action.payload.field]: _removed, ...rest } = state.fieldSelections;
      return {
        ...state,
        fieldSelections: rest,
      };
    }

    // Provider searches
    case ActionType.START_PROVIDER_SEARCH:
      return {
        ...state,
        providerSearches: {
          ...state.providerSearches,
          [action.payload.provider]: createLoadingResult(),
        },
      };

    case ActionType.UPDATE_PROVIDER_SEARCH:
      return {
        ...state,
        providerSearches: {
          ...state.providerSearches,
          [action.payload.provider]: action.payload.result,
        },
      };

    case ActionType.COMPLETE_PROVIDER_SEARCH:
      return {
        ...state,
        providerSearches: {
          ...state.providerSearches,
          [action.payload.provider]: createSuccessResult(action.payload.results),
        },
      };

    case ActionType.FAIL_PROVIDER_SEARCH:
      return {
        ...state,
        providerSearches: {
          ...state.providerSearches,
          [action.payload.provider]: createErrorResult(action.payload.error),
        },
      };

    // Source selection
    case ActionType.SELECT_SOURCE:
      return {
        ...state,
        selectedSources: {
          ...state.selectedSources,
          [action.payload.provider]: action.payload.manga,
        },
      };

    case ActionType.DESELECT_SOURCE: {
      const { [action.payload.provider]: _removed, ...rest } = state.selectedSources;
      return {
        ...state,
        selectedSources: rest,
      };
    }

    case ActionType.CLEAR_SOURCES:
      return {
        ...state,
        selectedSources: {},
      };

    // Download config
    case ActionType.UPDATE_DOWNLOAD_CONFIG:
      return {
        ...state,
        downloadConfig: {
          ...state.downloadConfig,
          ...action.payload,
        },
      };

    case ActionType.RESET_DOWNLOAD_CONFIG:
      return {
        ...state,
        downloadConfig: initialDownloadConfig,
      };

    // Metadata URLs
    case ActionType.ADD_METADATA_URL:
      if (state.metadataUrls.includes(action.payload)) {
        return state; // URL already exists
      }
      return {
        ...state,
        metadataUrls: [...state.metadataUrls, action.payload],
      };

    case ActionType.REMOVE_METADATA_URL:
      return {
        ...state,
        metadataUrls: state.metadataUrls.filter(url => url !== action.payload),
      };

    case ActionType.CLEAR_METADATA_URLS:
      return {
        ...state,
        metadataUrls: [],
      };

    // UI state
    case ActionType.SET_ACTIVE_TAB:
      return {
        ...state,
        activeTab: action.payload,
      };

    case ActionType.TOGGLE_SECTION: {
      const newSections = new Set(state.expandedSections);
      if (newSections.has(action.payload)) {
        newSections.delete(action.payload);
      } else {
        newSections.add(action.payload);
      }
      return {
        ...state,
        expandedSections: newSections,
      };
    }

    case ActionType.SET_CONFIRMING:
      return {
        ...state,
        isConfirming: action.payload,
        confirmationError: action.payload ? null : state.confirmationError,
      };

    case ActionType.SET_CONFIRMATION_ERROR:
      return {
        ...state,
        confirmationError: action.payload,
        isConfirming: false,
      };

    // Monitoring
    case ActionType.SET_MONITORING_ENABLED:
      return {
        ...state,
        monitoringEnabled: action.payload,
      };

    case ActionType.SET_MONITORING_INTERVAL:
      return {
        ...state,
        monitoringInterval: action.payload,
      };

    // Enhancement
    case ActionType.START_ENHANCEMENT:
      return {
        ...state,
        enhancementStatus: {
          ...state.enhancementStatus,
          [action.payload.provider]: createLoadingResult(),
        },
      };

    case ActionType.UPDATE_ENHANCEMENT:
      return {
        ...state,
        enhancementStatus: {
          ...state.enhancementStatus,
          [action.payload.provider]: action.payload.status,
        },
      };

    case ActionType.COMPLETE_ENHANCEMENT:
      return {
        ...state,
        enhancementStatus: {
          ...state.enhancementStatus,
          [action.payload.provider]: createSuccessResult(action.payload.data),
        },
      };

    case ActionType.FAIL_ENHANCEMENT:
      return {
        ...state,
        enhancementStatus: {
          ...state.enhancementStatus,
          [action.payload.provider]: createErrorResult(action.payload.error),
        },
      };

    // History
    case ActionType.UNDO: {
      if (state.history.past.length === 0) {
        return state;
      }
      const previous = state.history.past[state.history.past.length - 1];
      const { history, ...currentState } = state;
      return {
        ...previous,
        history: {
          past: history.past.slice(0, -1),
          future: [currentState, ...history.future],
        },
      } as AddMangaState;
    }

    case ActionType.REDO: {
      if (state.history.future.length === 0) {
        return state;
      }
      const next = state.history.future[0];
      const { history, ...currentState } = state;
      return {
        ...next,
        history: {
          past: [...history.past, currentState],
          future: history.future.slice(1),
        },
      } as AddMangaState;
    }

    case ActionType.SAVE_HISTORY:
      return saveToHistory(state);

    default:
      return state;
  }
}

/**
 * Action creators
 */
export const actions = {
  // Initial setup
  initializeState: (state: Partial<AddMangaState>): { type: ActionType.INITIALIZE_STATE; payload: Partial<AddMangaState> } => ({
    type: ActionType.INITIALIZE_STATE as const,
    payload: state,
  }),

  resetState: (): { type: ActionType.RESET_STATE } => ({
    type: ActionType.RESET_STATE as const,
  }),

  // Field updates
  updateField: (field: string, selection: FieldSelection): { type: ActionType.UPDATE_FIELD; payload: { field: string; selection: FieldSelection } } => ({
    type: ActionType.UPDATE_FIELD as const,
    payload: { field, selection },
  }),

  updateMultipleFields: (fields: Record<string, FieldSelection>): { type: ActionType.UPDATE_MULTIPLE_FIELDS; payload: Record<string, FieldSelection> } => ({
    type: ActionType.UPDATE_MULTIPLE_FIELDS as const,
    payload: fields,
  }),

  resetField: (field: string): { type: ActionType.RESET_FIELD; payload: { field: string } } => ({
    type: ActionType.RESET_FIELD as const,
    payload: { field },
  }),

  // Provider searches
  startProviderSearch: (provider: string): { type: ActionType.START_PROVIDER_SEARCH; payload: { provider: string } } => ({
    type: ActionType.START_PROVIDER_SEARCH as const,
    payload: { provider },
  }),

  completeProviderSearch: (provider: string, results: MangaSearchResult[]): { type: ActionType.COMPLETE_PROVIDER_SEARCH; payload: { provider: string; results: MangaSearchResult[] } } => ({
    type: ActionType.COMPLETE_PROVIDER_SEARCH as const,
    payload: { provider, results },
  }),

  failProviderSearch: (provider: string, error: Error): { type: ActionType.FAIL_PROVIDER_SEARCH; payload: { provider: string; error: Error } } => ({
    type: ActionType.FAIL_PROVIDER_SEARCH as const,
    payload: { provider, error },
  }),

  // Source selection
  selectSource: (provider: string, manga: MangaSearchResult): { type: ActionType.SELECT_SOURCE; payload: { provider: string; manga: MangaSearchResult } } => ({
    type: ActionType.SELECT_SOURCE as const,
    payload: { provider, manga },
  }),

  deselectSource: (provider: string): { type: ActionType.DESELECT_SOURCE; payload: { provider: string } } => ({
    type: ActionType.DESELECT_SOURCE as const,
    payload: { provider },
  }),

  clearSources: (): { type: ActionType.CLEAR_SOURCES } => ({
    type: ActionType.CLEAR_SOURCES as const,
  }),

  // Download config
  updateDownloadConfig: (config: Partial<DownloadConfig>): { type: ActionType.UPDATE_DOWNLOAD_CONFIG; payload: Partial<DownloadConfig> } => ({
    type: ActionType.UPDATE_DOWNLOAD_CONFIG as const,
    payload: config,
  }),

  resetDownloadConfig: (): { type: ActionType.RESET_DOWNLOAD_CONFIG } => ({
    type: ActionType.RESET_DOWNLOAD_CONFIG as const,
  }),

  // Metadata URLs
  addMetadataUrl: (url: string): { type: ActionType.ADD_METADATA_URL; payload: string } => ({
    type: ActionType.ADD_METADATA_URL as const,
    payload: url,
  }),

  removeMetadataUrl: (url: string): { type: ActionType.REMOVE_METADATA_URL; payload: string } => ({
    type: ActionType.REMOVE_METADATA_URL as const,
    payload: url,
  }),

  clearMetadataUrls: (): { type: ActionType.CLEAR_METADATA_URLS } => ({
    type: ActionType.CLEAR_METADATA_URLS as const,
  }),

  // UI state
  setActiveTab: (tab: string): { type: ActionType.SET_ACTIVE_TAB; payload: string } => ({
    type: ActionType.SET_ACTIVE_TAB as const,
    payload: tab,
  }),

  toggleSection: (section: string): { type: ActionType.TOGGLE_SECTION; payload: string } => ({
    type: ActionType.TOGGLE_SECTION as const,
    payload: section,
  }),

  setConfirming: (confirming: boolean): { type: ActionType.SET_CONFIRMING; payload: boolean } => ({
    type: ActionType.SET_CONFIRMING as const,
    payload: confirming,
  }),
  
  setConfirmationError: (error: string | null): { type: ActionType.SET_CONFIRMATION_ERROR; payload: string | null } => ({
    type: ActionType.SET_CONFIRMATION_ERROR as const,
    payload: error,
  }),

  // Monitoring
  setMonitoringEnabled: (enabled: boolean): { type: ActionType.SET_MONITORING_ENABLED; payload: boolean } => ({
    type: ActionType.SET_MONITORING_ENABLED as const,
    payload: enabled,
  }),

  setMonitoringInterval: (interval: string): { type: ActionType.SET_MONITORING_INTERVAL; payload: string } => ({
    type: ActionType.SET_MONITORING_INTERVAL as const,
    payload: interval,
  }),

  // History
  undo: (): { type: ActionType.UNDO } => ({
    type: ActionType.UNDO as const,
  }),

  redo: (): { type: ActionType.REDO } => ({
    type: ActionType.REDO as const,
  }),

  saveHistory: (): { type: ActionType.SAVE_HISTORY } => ({
    type: ActionType.SAVE_HISTORY as const,
  }),
};