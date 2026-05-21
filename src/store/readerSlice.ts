import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

import type {
  ReaderState,
  ReaderSettings,
  MangaFile,
  ReadingHistoryItem,
  Bookmark } from
'../types/reader/reader-types';

interface ReaderStore extends ReaderState {
  // Actions
  setFile: (file: MangaFile) => void;
  setPage: (page: number) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: Error | null) => void;
  updateSettings: (settings: Partial<ReaderSettings>) => void;
  addToHistory: (item: ReadingHistoryItem) => void;
  addBookmark: (bookmark: Bookmark) => void;
  removeBookmark: (bookmarkId: string) => void;
  reset: () => void;
}

const defaultSettings: ReaderSettings = {
  readingMode: 'single',
  readingDirection: 'rtl', // Default for manga
  backgroundColor: '#000000',
  fitMode: 'fit-width',
  showToolbar: true,
  preloadPages: 3,
  doublePageOffset: false,
  brightness: 1.0,
  contrast: 1.0,
  enableGestures: true,
  enableKeyboard: true,
  clickNavigation: true,
  smoothScrolling: true,
  panelDetection: false,
  ocrEnabled: false
};

export const useReaderStore = create<ReaderStore>()(
  devtools(
    persist(
      (set) => ({
        // Initial state
        currentFile: null,
        currentPage: 1,
        totalPages: 0,
        isLoading: false,
        error: null,
        settings: defaultSettings,
        history: [],
        bookmarks: [],

        // Actions
        setFile: (file) => set({
          currentFile: file,
          totalPages: file.totalPages,
          currentPage: 1,
          error: null
        }),

        setPage: (page) => set({ currentPage: page }),

        setLoading: (loading) => set({ isLoading: loading }),

        setError: (error) => set({ error }),

        updateSettings: (newSettings) => set((state) => ({
          settings: { ...state.settings, ...newSettings }
        })),

        addToHistory: (item) => set((state) => ({
          history: [item, ...state.history.slice(0, 99)] // Keep last 100 items
        })),

        addBookmark: (bookmark) => set((state) => ({
          bookmarks: [...state.bookmarks, bookmark]
        })),

        removeBookmark: (bookmarkId) => set((state) => ({
          bookmarks: state.bookmarks.filter((b) => b["id"] !== bookmarkId)
        })),

        reset: () => set({
          currentFile: null,
          currentPage: 1,
          totalPages: 0,
          isLoading: false,
          error: null
        })
      }),
      {
        name: 'reader-storage',
        partialize: (state) => ({
          settings: state.settings,
          history: state.history.slice(0, 20), // Only persist recent history
          bookmarks: state.bookmarks
        })
      }
    ),
    {
      name: 'reader-store'
    }
  )
);