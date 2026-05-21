/**
 * UI Store Slice Module
 * 
 * This module manages the application's UI state including:
 * - Sidebar visibility
 * - Modal management
 * - Loading states
 * - Error messages
 * - Theme preferences
 * - Notification settings
 * 
 * @module uiSlice
 */

import { createIdleResult } from '../utils/async-result';

import { createAppSlice } from './createStore';

import type { AsyncResult} from '../utils/async-result';

/**
 * Filter state configuration
 * 
 * Defines the structure of manga list filters including:
 * - Search term for text search
 * - Source filters for provider selection
 * - Status filters for manga status
 * - Genre and tag filters for categorization
 */
export interface FilterState {
  searchTerm: string;
  sources: string[];
  status: string[];
  genres: string[];
  tags: string[];
}

/**
 * Theme configuration
 */
export interface ThemeConfig {
  colorScheme: 'light' | 'dark' | 'system';
  fontSize: 'sm' | 'md' | 'lg';
  spacing: 'compact' | 'normal' | 'comfortable';
}

/**
 * Notification settings
 */
export interface NotificationSettings {
  enabled: boolean;
  sound: boolean;
  position: 'top-right' | 'top-center' | 'top-left';
}

/**
 * UI state data structure
 * 
 * Contains all state related to UI presentation and behavior:
 * - Layout configuration
 * - Modal and loading states
 * - Error messages
 * - Theme settings
 * - Notification preferences
 * - Async results for UI operations
 */
export type UIStateData = {
  sidebarCollapsed: boolean;
  currentModal: string | null;
  loadingStates: Record<string, boolean>;
  loading: boolean;
  errors: Record<string, string | null>;
  filters: FilterState;
  theme: ThemeConfig;
  notifications: NotificationSettings;
  themeUpdateResult: AsyncResult<ThemeConfig, Error>;
  notificationUpdateResult: AsyncResult<NotificationSettings, Error>;
  deduplicateManga: boolean;
} & Record<string, unknown>;

/**
 * UI store actions interface
 * 
 * Defines all available actions for managing UI state:
 * - Toggle sidebar visibility
 * - Control modals
 * - Manage loading states
 * - Set and clear error messages
 * - Update theme and notification settings
 * - Reset UI state
 * - Set async results
 */
export type UIActions = {
  toggleSidebar: () => void;
  setModal: (modalId: string | null) => void;
  setLoading: (key: string, isLoading: boolean) => void;
  setError: (key: string, error: string | null) => void;
  clearError: (key: string) => void;
  setFilters: (updates: Partial<FilterState>) => void;
  updateTheme: (updates: Partial<ThemeConfig>) => void;
  updateNotifications: (updates: Partial<NotificationSettings>) => void;
  resetUIState: () => void;
  setDeduplicateManga: (enabled: boolean) => void;

  // Async result setters
  setThemeUpdateResult: (result: AsyncResult<ThemeConfig, Error>) => void;
  setNotificationUpdateResult: (result: AsyncResult<NotificationSettings, Error>) => void;
} & Record<string, unknown>;

/**
 * Combined UI state type
 * Includes both state data and actions
 */
export type UIState = UIStateData & UIActions;

/**
 * Initial UI state
 * 
 * Provides default values for all UI-related state:
 * - Expanded sidebar
 * - No active modal
 * - Empty loading and error states
 * - System theme preference
 * - Default notification settings
 * - Idle async results
 */
export const initialState: UIStateData = {
  sidebarCollapsed: false,
  currentModal: null,
  loadingStates: {},
  loading: false,
  errors: {},
  filters: {
    searchTerm: '',
    sources: [],
    status: [],
    genres: [],
    tags: []
  },
  theme: {
    colorScheme: 'system',
    fontSize: 'md',
    spacing: 'normal'
  },
  notifications: {
    enabled: true,
    sound: true,
    position: 'top-center'
  },
  themeUpdateResult: createIdleResult<ThemeConfig, Error>(),
  notificationUpdateResult: createIdleResult<NotificationSettings, Error>(),
  deduplicateManga: false
};

/**
 * UI store slice
 * 
 * Creates a store slice with state and actions for managing UI presentation.
 * Uses immer for immutable state updates.
 * 
 * @example
 * // Show a loading indicator
 * useUIStore.getState().setLoading('save-settings', true);
 * 
 * // Update theme settings
 * useUIStore.getState().updateTheme({
 *   colorScheme: 'dark',
 *   fontSize: 'lg'
 * });
 * 
 * // Show an error message
 * useUIStore.getState().setError(
 *   'api-error',
 *   'Failed to connect to server'
 * );
 */
export const useUIStore = createAppSlice<UIStateData, UIActions>(initialState, 'ui')(set => ({
  ...initialState,
  toggleSidebar: () => set(state => {
    state.sidebarCollapsed = !state.sidebarCollapsed;
  }),
  setModal: (modalId: string | null) => set(state => {
    state.currentModal = modalId;
  }),
  setLoading: (key: string, isLoading: boolean) => set(state => {
    state.loadingStates[key] = isLoading;
    // Update global loading state based on any active loading states
    state.loading = Object.values(state.loadingStates).some(Boolean);
  }),
  setError: (key: string, error: string | null) => set(state => {
    state.errors[key] = error;
  }),
  clearError: (key: string) => set(state => {
    state.errors[key] = null;
  }),
  setFilters: (updates: Partial<FilterState>) => set(state => {
    state.filters = {
      ...state.filters,
      ...updates
    };
  }),
  updateTheme: (updates: Partial<ThemeConfig>) => set(state => {
    state.theme = {
      ...state.theme,
      ...updates
    };
  }),
  updateNotifications: (updates: Partial<NotificationSettings>) => set(state => {
    state.notifications = {
      ...state.notifications,
      ...updates
    };
  }),
  resetUIState: () => set(() => ({
    ...initialState
  })),
  setDeduplicateManga: (enabled: boolean) => set(state => {
    state.deduplicateManga = enabled;
  }),
  setThemeUpdateResult: (result: AsyncResult<ThemeConfig, Error>) => set(state => {
    state.themeUpdateResult = result;
  }),
  setNotificationUpdateResult: (result: AsyncResult<NotificationSettings, Error>) => set(state => {
    state.notificationUpdateResult = result;
  })
}));
