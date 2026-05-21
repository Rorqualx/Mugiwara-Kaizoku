/**
 * Test Setup - Store & Hook Mocks
 *
 * Mock implementations of Zustand stores and custom React hooks.
 * Extracted from: src/test/setup.ts (lines 517-649)
 */

import { jest } from '@jest/globals';

// Mock store hooks
jest.mock('@/store/useStoreActions', () => ({
  useStoreActions: jest.fn(() => ({
    manga: {
      setSelectedManga: jest.fn(),
      clearSelection: jest.fn(),
      updateManga: jest.fn()
    },
    library: {
      setSelectedLibrary: jest.fn(),
      clearSelection: jest.fn(),
      updateLibrary: jest.fn()
    },
    ui: {
      setTheme: jest.fn(),
      toggleSidebar: jest.fn(),
      setLoading: jest.fn()
    },
    sync: {
      setstring: jest.fn(),
      updateProgress: jest.fn()
    }
  }))
}));

jest.mock('@/store/useStoreSelectors', () => ({
  useStoreSelectors: jest.fn(() => ({
    manga: {
      selectedManga: null,
      mangaList: [],
      _loading: false
    },
    library: {
      selectedLibrary: null,
      libraries: [],
      _loading: false
    },
    ui: {
      theme: 'light',
      sidebarOpen: false,
      _loading: false
    },
    sync: {
      syncStatus: 'idle',
      progress: 0
    }
  }))
}));

// Mock individual store slices
jest.mock('@/store/mangaSlice', () => ({
  useMangaStore: jest.fn(() => ({
    selectedManga: null,
    mangaList: [],
    _loading: false,
    setSelectedManga: jest.fn(),
    clearSelection: jest.fn(),
    updateManga: jest.fn()
  }))
}));

jest.mock('@/store/uiSlice', () => ({
  useUIStore: jest.fn(() => ({
    theme: 'light',
    sidebarOpen: false,
    _loading: false,
    setTheme: jest.fn(),
    toggleSidebar: jest.fn(),
    setLoading: jest.fn()
  }))
}));

jest.mock('@/store/librarySlice', () => ({
  useLibraryStore: jest.fn(() => ({
    selectedLibrary: null,
    libraries: [],
    _loading: false,
    setSelectedLibrary: jest.fn(),
    clearSelection: jest.fn(),
    updateLibrary: jest.fn()
  }))
}));

// Mock search hook
jest.mock('@/hooks/useSearch', () => ({
  useSearch: jest.fn(() => ({
    query: '',
    setQuery: jest.fn(),
    results: [],
    _loading: false,
    error: null,
    handleMangaSelect: jest.fn()
  }))
}));

// Mock other common hooks
jest.mock('@/hooks/useManga', () => ({
  useManga: jest.fn(() => ({
    manga: null,
    _loading: false,
    error: null,
    refetch: jest.fn()
  }))
}));

jest.mock('@/hooks/useLibrary', () => ({
  useLibrary: jest.fn(() => ({
    libraries: [],
    _loading: false,
    error: null,
    createLibrary: jest.fn(),
    updateLibrary: jest.fn(),
    deleteLibrary: jest.fn()
  }))
}));

jest.mock('@/hooks/useSettings', () => ({
  useSettings: jest.fn(() => ({
    settings: {},
    _loading: false,
    error: null,
    updateSettings: jest.fn()
  }))
}));

jest.mock('@/hooks/useMetadata', () => ({
  useMetadata: jest.fn(() => ({
    metadata: null,
    _loading: false,
    error: null,
    refreshMetadata: jest.fn()
  }))
}));
