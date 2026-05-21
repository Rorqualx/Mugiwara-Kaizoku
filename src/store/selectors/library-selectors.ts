/**
 * Library Selectors Module
 *
 * Provides memoized selectors for library selection and manga relationships.
 * Handles library state, scanning progress, and library-manga associations.
 *
 * Key Features:
 * - Stable reference management using refs
 * - Efficient change detection to minimize re-renders
 * - Circular dependency breaking between library and manga
 * - Library scanning progress tracking
 *
 * React Hook Dependency Fixes:
 * - selectedLibraryManga: Added missing currentLibraryObject dependency
 * - currentLibrary: Added missing currentLibraryObject and selectedLibraryManga dependencies
 *
 * Performance Considerations:
 * - Uses refs to maintain stable references across renders
 * - Implements efficient change detection (length check + Set-based comparison)
 * - Breaks circular dependencies through selective memoization
 * - Only re-creates objects when actual changes detected
 *
 * Extracted from: useStoreSelectors.ts (lines 338-449, 545-555)
 *
 * @module store/selectors/library-selectors
 */

import { useMemo, useRef } from 'react';


import { toStringId, toNumberId } from '@/utils/id-converters';

import { useMangaStore, useLibraryStore } from '../index';

import type { LibraryWithMangas, ScanProgress, ScanSettings } from './types';
import type { Library } from '@prisma/client';

/**
 * Library selectors interface
 *
 * Provides access to:
 * - Current library with manga relationships
 * - Manga list for selected library
 * - Library scanning progress
 * - Library scanning settings
 *
 * @interface LibrarySelectors
 *
 * @example
 * ```typescript
 * const {
 *   currentLibrary,
 *   selectedLibraryManga,
 *   scanProgress,
 *   scanSettings
 * } = useLibrarySelectors();
 *
 * // Access current library
 * logger.info(currentLibrary?.name);
 *
 * // Get manga count
 * const count = selectedLibraryManga.length;
 *
 * // Check scan status
 * if (scanProgress.status === 'scanning') {
 *   logger.info(`Scanning: ${scanProgress.current}/${scanProgress.total}`);
 * }
 * ```
 */
export interface LibrarySelectors {
  /** Currently selected library with manga relationships */
  currentLibrary: LibraryWithMangas | null;

  /** Manga list for the selected library */
  selectedLibraryManga: Array<{ id: number; title: string }>;

  /** Library scan progress information */
  scanProgress: ScanProgress;

  /** Library scan configuration */
  scanSettings: ScanSettings;

  /** Full list of libraries */
  libraries: Library[];

  /** Whether library scanning is in progress */
  scanning: boolean;
}

/**
 * Library selectors hook
 *
 * Provides memoized selectors for library selection and manga relationships.
 * Implements stable reference management and efficient change detection.
 *
 * Implementation Details:
 * - Uses refs to prevent unnecessary re-renders
 * - Implements two-stage change detection (length + Set-based)
 * - Breaks circular dependency between library and manga
 * - Only re-creates objects when properties actually change
 *
 * React Hook Dependency Fixes:
 * - selectedLibraryManga now depends on currentLibraryObject
 * - currentLibrary now depends on currentLibraryObject and selectedLibraryManga
 *
 * @returns {LibrarySelectors} Library state and scanning information
 *
 * @example
 * ```typescript
 * function LibraryView() {
 *   const { currentLibrary, selectedLibraryManga } = useLibrarySelectors();
 *
 *   if (!currentLibrary) {
 *     return <div>No library selected</div>;
 *   }
 *
 *   return (
 *     <div>
 *       <h2>{currentLibrary.name}</h2>
 *       <p>{selectedLibraryManga.length} manga</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useLibrarySelectors(): LibrarySelectors {
  // Get state from stores
  const mangaState = useMangaStore((state) => ({
    mangaList: state.mangaList
  }));

  const libraryState = useLibraryStore((state) => ({
    selectedLibraryId: state.selectedLibraryId,
    libraries: state.libraries,
    scanProgress: state.scanProgress,
    scanning: state.scanning
  }));

  // Refs for stable references across renders
  // These prevent unnecessary re-renders by maintaining stable references
  // when the underlying data hasn't changed
  const prevLibraryRef = useRef<LibraryWithMangas | null>(null);
  const prevMangaForLibraryRef = useRef<Array<{
    id: number;
    title: string;
  }>>([]);

  // Store the selected library ID in a ref to track changes without triggering re-renders
  const selectedLibraryIdRef = useRef<number | null>(null);

  // Update the ref when the selected library ID changes
  if (selectedLibraryIdRef.current !== libraryState.selectedLibraryId) {
    selectedLibraryIdRef.current = libraryState.selectedLibraryId;
  }

  // Get the current selected library ID from the ref
  const selectedLibraryId = selectedLibraryIdRef.current;

  // Find the current library object
  const currentLibraryObject = useMemo(() => {
    if (!selectedLibraryId) return null;
    return libraryState.libraries.find(l => l.id === selectedLibraryId);
  }, [libraryState.libraries, selectedLibraryId]);

  /**
   * Memoize the manga list for the selected library with stable reference
   *
   * Implements two-stage change detection:
   * 1. Quick length comparison
   * 2. Detailed Set-based ID comparison
   *
   * Returns stable reference if no changes detected.
   *
   * FIXED: Added currentLibraryObject to dependency array to prevent
   * stale closure over currentLibraryObject.id
   */
  const selectedLibraryManga = useMemo(() => {
    // If no library is selected or found, return an empty array with a stable reference
    if (!selectedLibraryId || !currentLibraryObject) {
      return prevMangaForLibraryRef.current.length === 0 ? prevMangaForLibraryRef.current : [];
    }
    const mangaList = mangaState.mangaList;
    const libraryId = currentLibraryObject.id;

    // Create a new array of manga for the selected library
    const mangaForLibrary = mangaList.filter(m => {
      // Check if libraryId property exists and matches the target library
      return toStringId(m.libraryId) === toStringId(libraryId);
    }).map(m => ({
      id: toNumberId(m.id),
      // Force conversion to number
      title: m.title
    }));

    // Use a more efficient approach to check for changes
    // Compare length first as a quick check
    if (prevMangaForLibraryRef.current.length !== mangaForLibrary.length) {
      prevMangaForLibraryRef.current = mangaForLibrary;
      return mangaForLibrary;
    }

    // If lengths match, do a more detailed comparison
    let hasChanged = false;
    // Convert IDs to strings for consistent comparison
    const prevIds = new Set(prevMangaForLibraryRef.current.map(m => toStringId(m.id)));
    for (const manga of mangaForLibrary) {
      if (!prevIds.has(toStringId(manga.id))) {
        hasChanged = true;
        break;
      }
    }
    if (hasChanged) {
      prevMangaForLibraryRef.current = mangaForLibrary;
      return mangaForLibrary;
    }

    // Return the stable reference if nothing changed
    return prevMangaForLibraryRef.current;
  }, [
    // FIXED: Added currentLibraryObject to prevent stale closure
    // Only depend on primitive values and stable references
    selectedLibraryId,
    currentLibraryObject,
    mangaState.mangaList
  ]);

  /**
   * Memoize the current library with stable reference
   *
   * Implements reference stability through:
   * - Reuse of previous reference when properties unchanged
   * - Only updating mangas array when needed
   * - Only creating new object when library properties change
   *
   * FIXED: Added currentLibraryObject and selectedLibraryManga to dependency array
   * to prevent stale closures. The circular dependency is broken through the ref-based
   * change detection in the implementation.
   */
  const currentLibrary = useMemo(() => {
    // If no library is selected or found, return null
    if (!selectedLibraryId || !currentLibraryObject) {
      prevLibraryRef.current = null;
      return null;
    }

    // Get the manga for this library from the memoized value
    // This creates a potential circular dependency, but we break it
    // using refs and selective property comparison
    const mangaForLibrary = selectedLibraryManga;

    // Check if we can reuse the previous library reference
    if (
      prevLibraryRef.current &&
      prevLibraryRef.current.id === currentLibraryObject.id &&
      prevLibraryRef.current.name === currentLibraryObject.name &&
      prevLibraryRef.current.path === currentLibraryObject.path
    ) {
      // If the library properties haven't changed, just update the mangas array if needed
      if (prevLibraryRef.current.mangas !== mangaForLibrary) {
        prevLibraryRef.current = {
          ...prevLibraryRef.current,
          mangas: mangaForLibrary
        };
      }
      return prevLibraryRef.current;
    }

    // Create a new library object only when necessary
    const newLibrary: LibraryWithMangas = {
      id: currentLibraryObject.id,
      name: currentLibraryObject.name,
      path: currentLibraryObject.path,
      createdAt: currentLibraryObject.createdAt,
      mangas: mangaForLibrary
    };

    // Update the ref with the new value
    prevLibraryRef.current = newLibrary;
    return newLibrary;
  }, [
    // FIXED: Added currentLibraryObject and selectedLibraryManga to prevent stale closures
    // The circular dependency is broken by the ref-based change detection above
    selectedLibraryId,
    currentLibraryObject,
    selectedLibraryManga
  ]);

  /**
   * Library scan progress information
   *
   * Tracks the current state of library scanning operations.
   * Provides normalized progress information (current/total/status).
   */
  const scanProgress = useMemo(() => ({
    current: typeof libraryState.scanProgress === 'number' ? libraryState.scanProgress : 0,
    total: 100,
    status: libraryState.scanning ? 'scanning' : 'idle'
  }), [libraryState.scanProgress, libraryState.scanning]);

  /**
   * Library scan settings
   *
   * Configuration for library scanning operations.
   * Currently returns default values - extend as needed.
   */
  const scanSettings = useMemo(() => ({
    scanPath: '',
    targetLibraryId: null
  }), []);

  return {
    currentLibrary,
    selectedLibraryManga,
    scanProgress,
    scanSettings,
    libraries: libraryState.libraries,
    scanning: libraryState.scanning
  };
}
