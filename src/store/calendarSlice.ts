/**
 * Calendar State Slice
 * 
 * Manages calendar UI state including filters, view preferences, and selections.
 * Provides centralized state management for calendar features.
 * 
 * @module store/calendarSlice
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

import type { EventStatus } from '@prisma/client';

/**
 * Calendar filter preferences
 */
export interface CalendarFilters {
  selectedManga: number[];
  statusFilter: EventStatus[];
  dateRange: {
    start: Date;
    end: Date;
  };
  showConfirmed: boolean;
  showDelayed: boolean;
}

/**
 * Calendar view preferences
 */
export interface CalendarViewState {
  view: 'month' | 'week' | 'agenda' | 'list';
  currentDate: Date;
  colorScheme: 'manga' | 'status';
  timezone: string;
}

/**
 * Keyboard shortcut preferences
 */
export interface KeyboardShortcutPreferences {
  /** Whether keyboard shortcuts are enabled */
  enabled: boolean;
  /** Whether shortcuts require modifier key (Ctrl/Cmd) */
  requireModifierKey: boolean;
}

/**
 * Export preferences
 */
export interface ExportPreferences {
  format: 'ical' | 'csv' | 'json' | 'google';
  dateRange: 'all' | 'upcoming' | 'custom';
  customRange?: {
    start: Date;
    end: Date;
  };
}

/**
 * Calendar state data interface
 */
export interface CalendarStateData {
  filters: CalendarFilters;
  viewState: CalendarViewState;
  exportPrefs: ExportPreferences;
  keyboardPrefs: KeyboardShortcutPreferences;
  selectedEventId: number | null;
  isFilterPanelOpen: boolean;
  isExportModalOpen: boolean;
  isHelpModalOpen: boolean;
}

/**
 * Calendar actions interface
 */
export interface CalendarActions {
  // Filter actions
  setSelectedManga: (mangaIds: number[]) => void;
  toggleMangaFilter: (mangaId: number) => void;
  setStatusFilter: (statuses: EventStatus[]) => void;
  setDateRange: (start: Date, end: Date) => void;
  toggleConfirmed: () => void;
  toggleDelayed: () => void;
  resetFilters: () => void;

  // View actions
  setView: (view: CalendarViewState['view']) => void;
  setCurrentDate: (date: Date) => void;
  setColorScheme: (scheme: CalendarViewState['colorScheme']) => void;
  setTimezone: (timezone: string) => void;

  // Export actions
  setExportFormat: (format: ExportPreferences['format']) => void;
  setExportDateRange: (range: ExportPreferences['dateRange']) => void;
  setExportCustomRange: (start: Date, end: Date) => void;

  // UI actions
  setSelectedEvent: (eventId: number | null) => void;
  toggleFilterPanel: () => void;
  toggleExportModal: () => void;
  toggleHelpModal: () => void;
  setExportModalOpen: (open: boolean) => void;
  setHelpModalOpen: (open: boolean) => void;

  // Keyboard actions
  setKeyboardShortcutsEnabled: (enabled: boolean) => void;
  setRequireModifierKey: (require: boolean) => void;
  toggleKeyboardShortcuts: () => void;

  // Computed
  getActiveFiltersCount: () => number;
  hasActiveFilters: () => boolean;
}

/**
 * Complete calendar state interface
 */
export interface CalendarState extends CalendarStateData, CalendarActions {}

/**
 * Default filter values
 */
const defaultFilters: CalendarFilters = {
  selectedManga: [],
  statusFilter: [],
  dateRange: {
    start: new Date(),
    end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days ahead
  },
  showConfirmed: true,
  showDelayed: true
};

/**
 * Default view state
 */
const defaultViewState: CalendarViewState = {
  view: 'month',
  currentDate: new Date(),
  colorScheme: 'status',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
};

/**
 * Default export preferences
 */
const defaultExportPrefs: ExportPreferences = {
  format: 'ical',
  dateRange: 'upcoming'
};

/**
 * Default keyboard shortcut preferences
 */
const defaultKeyboardPrefs: KeyboardShortcutPreferences = {
  enabled: true,
  requireModifierKey: false
};

/**
 * Initial calendar state
 */
const initialState: CalendarStateData = {
  filters: defaultFilters,
  viewState: defaultViewState,
  exportPrefs: defaultExportPrefs,
  keyboardPrefs: defaultKeyboardPrefs,
  selectedEventId: null,
  isFilterPanelOpen: false,
  isExportModalOpen: false,
  isHelpModalOpen: false
};

/**
 * Calendar store hook
 */
export const useCalendarStore = create<CalendarState>()(
  devtools(
    persist(
      immer((set, get) => ({
        // State
        ...initialState,
        
        // Filter actions
        setSelectedManga: (mangaIds) => set((state) => {
          state.filters.selectedManga = mangaIds;
        }),
        
        toggleMangaFilter: (mangaId) => set((state) => {
          const index = state.filters.selectedManga.indexOf(mangaId);
          if (index > -1) {
            state.filters.selectedManga.splice(index, 1);
          } else {
            state.filters.selectedManga.push(mangaId);
          }
        }),

        setStatusFilter: (statuses) => set((state) => {
          state.filters.statusFilter = statuses;
        }),

        setDateRange: (start, end) => set((state) => {
          state.filters.dateRange = { start, end };
        }),

        toggleConfirmed: () => set((state) => {
          state.filters.showConfirmed = !state.filters.showConfirmed;
        }),
        
        toggleDelayed: () => set((state) => {
          state.filters.showDelayed = !state.filters.showDelayed;
        }),
        
        resetFilters: () => set((state) => {
          state.filters = defaultFilters;
        }),
        
        // View actions
        setView: (view) => set((state) => {
          state.viewState.view = view;
        }),
        
        setCurrentDate: (currentDate) => set((state) => {
          state.viewState.currentDate = currentDate;
        }),
        
        setColorScheme: (colorScheme) => set((state) => {
          state.viewState.colorScheme = colorScheme;
        }),

        setTimezone: (timezone) => set((state) => {
          state.viewState.timezone = timezone;
        }),
        
        // Export actions
        setExportFormat: (format) => set((state) => {
          state.exportPrefs.format = format;
        }),
        
        setExportDateRange: (dateRange) => set((state) => {
          state.exportPrefs.dateRange = dateRange;
        }),
        
        setExportCustomRange: (start, end) => set((state) => {
          state.exportPrefs.customRange = { start, end };
        }),

        // UI actions
        setSelectedEvent: (selectedEventId) => set((state) => {
          state.selectedEventId = selectedEventId;
        }),
        
        toggleFilterPanel: () => set((state) => {
          state.isFilterPanelOpen = !state.isFilterPanelOpen;
        }),
        
        toggleExportModal: () => set((state) => {
          state.isExportModalOpen = !state.isExportModalOpen;
        }),
        
        toggleHelpModal: () => set((state) => {
          state.isHelpModalOpen = !state.isHelpModalOpen;
        }),
        
        setExportModalOpen: (open) => set((state) => {
          state.isExportModalOpen = open;
        }),
        
        setHelpModalOpen: (open) => set((state) => {
          state.isHelpModalOpen = open;
        }),

        // Keyboard actions
        setKeyboardShortcutsEnabled: (enabled) => set((state) => {
          state.keyboardPrefs.enabled = enabled;
        }),

        setRequireModifierKey: (require) => set((state) => {
          state.keyboardPrefs.requireModifierKey = require;
        }),

        toggleKeyboardShortcuts: () => set((state) => {
          state.keyboardPrefs.enabled = !state.keyboardPrefs.enabled;
        }),

        // Computed
        getActiveFiltersCount: () => {
          const state = get();
          let count = 0;

          if (state.filters.selectedManga.length > 0) count++;
          if (state.filters.statusFilter.length > 0) count++;
          if (!state.filters.showConfirmed) count++;
          if (!state.filters.showDelayed) count++;

          return count;
        },
        
        hasActiveFilters: () => {
          return get().getActiveFiltersCount() > 0;
        }
      })),
      {
        name: 'kaizoku-calendar',
        partialize: (state) => ({
          filters: state.filters,
          viewState: state.viewState,
          exportPrefs: state.exportPrefs,
          keyboardPrefs: state.keyboardPrefs
        })
      }
    ),
    {
      name: 'CalendarStore'
    }
  )
);
