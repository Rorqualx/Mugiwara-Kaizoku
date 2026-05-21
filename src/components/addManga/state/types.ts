/**
 * State Management Types
 * 
 * Type definitions for the Add Manga workflow state management
 */

import type { MangaSearchResult } from '@/types/search.types';
import type { AsyncResult } from '@/utils/async-result';

import type { ExtendedMangaSearchResult } from '../types/search.types';

/**
 * Field selection state for metadata fields
 */
export interface FieldSelection {
  value: unknown;
  source: string;
  confidence?: number;
  isManuallyEdited?: boolean;
}

/**
 * Download configuration state
 */
export interface DownloadConfig {
  autoDownload: boolean;
  downloadQuality: 'low' | 'medium' | 'high';
  startChapter: number;
  endChapter?: number;
  downloadNewChapters: boolean;
  notifyOnComplete: boolean;
}

/**
 * Provider search state
 */
export interface ProviderSearchState {
  [provider: string]: AsyncResult<MangaSearchResult[]>;
}

/**
 * Selected sources for metadata aggregation
 */
export interface SelectedSources {
  [provider: string]: MangaSearchResult;
}

/**
 * Main workflow state
 */
export interface AddMangaState {
  // Original selection
  originalManga: ExtendedMangaSearchResult | null;
  selectedProvider: string | null;
  
  // Field selections
  fieldSelections: Record<string, FieldSelection>;
  
  // Provider search results
  providerSearches: ProviderSearchState;
  
  // Selected sources for aggregation
  selectedSources: SelectedSources;
  
  // Download configuration
  downloadConfig: DownloadConfig;
  
  // Metadata URLs
  metadataUrls: string[];
  
  // UI state
  activeTab: string;
  expandedSections: Set<string>;
  isConfirming: boolean;
  confirmationError: string | null;
  
  // Monitoring configuration
  monitoringEnabled: boolean;
  monitoringInterval: string;
  
  // Enhancement state
  enhancementStatus: Record<string, AsyncResult<unknown>>;
  
  // History for undo/redo
  history: {
    past: Partial<AddMangaState>[];
    future: Partial<AddMangaState>[];
  };
}

/**
 * Action types for state updates
 */
export enum ActionType {
  // Initial setup
  INITIALIZE_STATE = 'INITIALIZE_STATE',
  RESET_STATE = 'RESET_STATE',
  
  // Field updates
  UPDATE_FIELD = 'UPDATE_FIELD',
  UPDATE_MULTIPLE_FIELDS = 'UPDATE_MULTIPLE_FIELDS',
  RESET_FIELD = 'RESET_FIELD',
  
  // Provider searches
  START_PROVIDER_SEARCH = 'START_PROVIDER_SEARCH',
  UPDATE_PROVIDER_SEARCH = 'UPDATE_PROVIDER_SEARCH',
  COMPLETE_PROVIDER_SEARCH = 'COMPLETE_PROVIDER_SEARCH',
  FAIL_PROVIDER_SEARCH = 'FAIL_PROVIDER_SEARCH',
  
  // Source selection
  SELECT_SOURCE = 'SELECT_SOURCE',
  DESELECT_SOURCE = 'DESELECT_SOURCE',
  CLEAR_SOURCES = 'CLEAR_SOURCES',
  
  // Download config
  UPDATE_DOWNLOAD_CONFIG = 'UPDATE_DOWNLOAD_CONFIG',
  RESET_DOWNLOAD_CONFIG = 'RESET_DOWNLOAD_CONFIG',
  
  // Metadata URLs
  ADD_METADATA_URL = 'ADD_METADATA_URL',
  REMOVE_METADATA_URL = 'REMOVE_METADATA_URL',
  CLEAR_METADATA_URLS = 'CLEAR_METADATA_URLS',
  
  // UI state
  SET_ACTIVE_TAB = 'SET_ACTIVE_TAB',
  TOGGLE_SECTION = 'TOGGLE_SECTION',
  SET_CONFIRMING = 'SET_CONFIRMING',
  SET_CONFIRMATION_ERROR = 'SET_CONFIRMATION_ERROR',
  
  // Monitoring
  SET_MONITORING_ENABLED = 'SET_MONITORING_ENABLED',
  SET_MONITORING_INTERVAL = 'SET_MONITORING_INTERVAL',
  
  // Enhancement
  START_ENHANCEMENT = 'START_ENHANCEMENT',
  UPDATE_ENHANCEMENT = 'UPDATE_ENHANCEMENT',
  COMPLETE_ENHANCEMENT = 'COMPLETE_ENHANCEMENT',
  FAIL_ENHANCEMENT = 'FAIL_ENHANCEMENT',
  
  // History
  UNDO = 'UNDO',
  REDO = 'REDO',
  SAVE_HISTORY = 'SAVE_HISTORY',
}

/**
 * Action definitions
 */
export type AddMangaAction =
  | { type: ActionType.INITIALIZE_STATE; payload: Partial<AddMangaState> }
  | { type: ActionType.RESET_STATE }
  | { type: ActionType.UPDATE_FIELD; payload: { field: string; selection: FieldSelection } }
  | { type: ActionType.UPDATE_MULTIPLE_FIELDS; payload: Record<string, FieldSelection> }
  | { type: ActionType.RESET_FIELD; payload: { field: string } }
  | { type: ActionType.START_PROVIDER_SEARCH; payload: { provider: string } }
  | { type: ActionType.UPDATE_PROVIDER_SEARCH; payload: { provider: string; result: AsyncResult<MangaSearchResult[]> } }
  | { type: ActionType.COMPLETE_PROVIDER_SEARCH; payload: { provider: string; results: MangaSearchResult[] } }
  | { type: ActionType.FAIL_PROVIDER_SEARCH; payload: { provider: string; error: Error } }
  | { type: ActionType.SELECT_SOURCE; payload: { provider: string; manga: MangaSearchResult } }
  | { type: ActionType.DESELECT_SOURCE; payload: { provider: string } }
  | { type: ActionType.CLEAR_SOURCES }
  | { type: ActionType.UPDATE_DOWNLOAD_CONFIG; payload: Partial<DownloadConfig> }
  | { type: ActionType.RESET_DOWNLOAD_CONFIG }
  | { type: ActionType.ADD_METADATA_URL; payload: string }
  | { type: ActionType.REMOVE_METADATA_URL; payload: string }
  | { type: ActionType.CLEAR_METADATA_URLS }
  | { type: ActionType.SET_ACTIVE_TAB; payload: string }
  | { type: ActionType.TOGGLE_SECTION; payload: string }
  | { type: ActionType.SET_CONFIRMING; payload: boolean }
  | { type: ActionType.SET_CONFIRMATION_ERROR; payload: string | null }
  | { type: ActionType.SET_MONITORING_ENABLED; payload: boolean }
  | { type: ActionType.SET_MONITORING_INTERVAL; payload: string }
  | { type: ActionType.START_ENHANCEMENT; payload: { provider: string } }
  | { type: ActionType.UPDATE_ENHANCEMENT; payload: { provider: string; status: AsyncResult<unknown> } }
  | { type: ActionType.COMPLETE_ENHANCEMENT; payload: { provider: string; data: unknown } }
  | { type: ActionType.FAIL_ENHANCEMENT; payload: { provider: string; error: Error } }
  | { type: ActionType.UNDO }
  | { type: ActionType.REDO }
  | { type: ActionType.SAVE_HISTORY };

/**
 * Selector types for derived state
 */
export interface Selectors {
  getFieldValue: (field: string) => unknown;
  getFieldSource: (field: string) => string | undefined;
  getFieldConfidence: (field: string) => number | undefined;
  isFieldManuallyEdited: (field: string) => boolean;
  getProviderSearchStatus: (provider: string) => AsyncResult<MangaSearchResult[]> | undefined;
  isProviderSearching: (provider: string) => boolean;
  hasProviderResults: (provider: string) => boolean;
  getSelectedSource: (provider: string) => MangaSearchResult | undefined;
  getAllSelectedSources: () => SelectedSources;
  getMetadataCompleteness: () => number;
  getOverallConfidence: () => number;
  canUndo: () => boolean;
  canRedo: () => boolean;
}