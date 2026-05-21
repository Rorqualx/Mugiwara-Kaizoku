/**
 * Grid component for displaying manga cards in a responsive layout
 * 
 * This component renders a grid of manga cards with an "Add Manga" button.
 * It supports infinite scrolling through intersection observer and integrates
 * with the global store for manga data management.
 * 
 * Features:
 * - Responsive grid layout with breakpoints
 * - Infinite scrolling support
 * - Integration with global store
 * - Add manga functionality
 * - Manga card interactions
 * 
 * @module MangaGrid
 * 
 * @example
 * ```tsx
 * // Basic usage in a page
 * function LibraryPage() {
 *   return (
 *     <div>
 *       <h1>My Manga Library</h1>
 *       <MangaGrid />
 *     </div>
 *   );
 * }
 * ```
 * 
 * @remarks
 * The component uses the following store selectors:
 * - filteredManga: Array of manga items filtered based on current criteria
 * - isLoading: Boolean indicating if data is being fetched
 * - currentLibrary: Currently selected library
 * 
 * And the following store actions:
 * - handleUpdateManga: Updates manga metadata
 * - setSelectedManga: Sets the currently selected manga
 * - setModal: Controls modal visibility
 * 
 * Grid Breakpoints:
 * - base: 1 column (< 576px)
 * - xs: 2 columns (≥ 576px)
 * - sm: 3 columns (≥ 768px)
 * - md: 4 columns (≥ 992px)
 * - lg: 5 columns (≥ 1200px)
 * - xl: 6 columns (≥ 1400px)
 */
import React from "react";
import { useEffect, useRef } from 'react';

import { SimpleGrid, Card, Text } from '@mantine/core';

import { useStoreActions } from '@/store/useStoreActions';
import { useStoreSelectors } from '@/store/useStoreSelectors';
import type {MangaWithRelations} from '@/types/search.types';
import { toNumberId } from '@/utils/id-converters';

import { AddMangaButton } from '../addManga/AddMangaButton';

import { MangaCard } from './MangaCard';

/**
 * Options for configuring the IntersectionObserver
 * 
 * These options control how the infinite scrolling behavior works:
 * - root: Viewport element for visibility checks
 * - rootMargin: Buffer zone around viewport
 * - threshold: Visibility percentage to trigger loading
 * 
 * @example
 * ```typescript
 * const options: IntersectionObserverOptions = {
 *   root: null, // Use browser viewport
 *   rootMargin: '20px', // 20px buffer
 *   threshold: 0.1 // Trigger at 10% visibility
 * };
 * ```
 */
interface IntersectionObserverOptions {
  /** The element that is used as the viewport for checking visibility of the target */
  root?: Element | null;
  /** Margin around the root element (e.g., "20px" loads items 20px before they're visible) */
  rootMargin?: string;
  /** Threshold(s) at which to trigger callback (0.1 = 10% visibility) */
  threshold?: number | number[];
}

/**
 * Displays a responsive grid of manga cards with an "Add Manga" button
 * 
 * This component fetches manga data from the global store and renders
 * them in a responsive grid layout. It includes an "Add Manga" button
 * and supports infinite scrolling through intersection observer.
 * 
 * Features:
 * - Responsive grid layout using Mantine's SimpleGrid
 * - Infinite scrolling with IntersectionObserver
 * - Integration with global store for state management
 * - Empty state handling for no library selected
 * - Manga card interactions (click, remove, update, refresh)
 * 
 * @returns {JSX.Element} A responsive grid of manga cards
 * 
 * @example
 * ```tsx
 * // With custom event handlers
 * function CustomLibrary() {
 *   const handleMangaSelect = (id: number) => {
 *     logger.info(`Selected manga: ${id}`);
 *   };
 * 
 *   return (
 *     <div>
 *       <h2>Custom Library View</h2>
 *       <MangaGrid />
 *     </div>
 *   );
 * }
 * ```
 */
/**
 * Props for the MangaGrid component
 */
export interface MangaGridProps {
  /** Optional custom update handler */
  onMangaUpdate?: (mangaId: number, data: Partial<MangaWithRelations>) => void;
  /** Optional custom selection handler */
  onMangaSelect?: (mangaId: number) => void;
}

/**
 * MangaGrid component for displaying manga cards in a responsive layout
 */
export function MangaGrid({
  onMangaUpdate,
  onMangaSelect
}: MangaGridProps = {}): React.ReactElement {
  /** Store selectors for manga data and UI state */
  const {
    filteredManga,
    currentLibrary,
    isLoading
  } = useStoreSelectors();

  /** Store actions for manga operations and UI updates */
  const storeActions = useStoreActions();

  // Type guard for store action functions (using bracket notation for index signatures)
  const handleUpdateManga = typeof storeActions["handleUpdateManga"] === 'function'
    ? storeActions["handleUpdateManga"] as (id: number, updates: Partial<MangaWithRelations>) => Promise<void>
    : (): void => { throw new Error('handleUpdateManga not available'); };

  const setSelectedManga = typeof storeActions["setSelectedManga"] === 'function'
    ? storeActions["setSelectedManga"] as (id: number | null) => void
    : () => { throw new Error('setSelectedManga not available'); };

  const setModal = typeof storeActions["setModal"] === 'function'
    ? storeActions["setModal"] as (modalId: string | null) => void
    : () => { throw new Error('setModal not available'); };

  /** Refs for intersection observer and last manga card */
  const observerRef = useRef<IntersectionObserver | null>(null);
  const lastItemRef = useRef<HTMLDivElement | null>(null);

  /**
   * Sets up intersection observer for infinite scrolling
   * 
   * When the last manga card becomes visible in the viewport,
   * this effect will trigger loading of more manga items.
   * The observer is cleaned up when the component unmounts.
   * 
   * Implementation details:
   * - Creates new IntersectionObserver with custom options
   * - Observes last manga card in the grid
   * - Triggers load more when card becomes visible
   * - Cleans up observer on unmount
   * 
   * @example
   * ```typescript
   * // Observer callback
   * (entries) => {
   *   if (entries[0]?.isIntersecting && !isLoading) {
   *     loadMoreManga();
   *   }
   * }
   * ```
   */
  useEffect(() => {
    const options: IntersectionObserverOptions = {
      root: null,
      // Use viewport as root
      rootMargin: '20px',
      // Start loading 20px before item is visible
      threshold: 0.1 // Trigger when 10% of item is visible
    };
    observerRef.current = new IntersectionObserver(entries => {
      const firstEntry = entries[0];
      if (firstEntry?.isIntersecting && !isLoading) {
        // TODO: Load more manga when implemented
        // Future implementation will trigger pagination here
      }
    }, options);
    if (lastItemRef.current) {
      observerRef.current.observe(lastItemRef.current);
    }
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [isLoading]);

  // Show message if no library is selected
  if (!currentLibrary) {
    return <Card shadow="sm" p="xl">
        <Text>No library selected. Please create or select a library.</Text>
      </Card>;
  }
  return <SimpleGrid cols={{
    base: 1,
    xs: 2,
    sm: 3,
    md: 4,
    lg: 5,
    xl: 6
  }}>

      {/* Add Manga button always appears first */}
      <AddMangaButton onClick={() => setModal('addManga')} />

      {/* Manga cards with intersection observer on last item */}
      {filteredManga.map((manga, index) => <div key={manga["id"]} ref={index === filteredManga.length - 1 ? lastItemRef : undefined}>

          <MangaCard manga={manga as MangaWithRelations} onRemove={() => {/* Handle remove - To be implemented */}} onUpdate={() => {
        // Use custom handler if provided, otherwise use store action
        if (onMangaUpdate) {
          onMangaUpdate(toNumberId(manga["id"]), {});
        } else {
          void handleUpdateManga(typeof manga["id"] === 'string' ? toNumberId(manga["id"]) : manga["id"], {});
        }
      }} onRefresh={() => {/* Handle refresh - To be implemented */}} onClick={() => {
        // Use custom selection handler if provided, otherwise use store actions
        if (onMangaSelect) {
          onMangaSelect(toNumberId(manga["id"]));
        } else {
          setSelectedManga(typeof manga["id"] === 'string' ? toNumberId(manga["id"]) : manga["id"]);
          setModal('mangaDetail');
        }
      }} />

        </div>)}
    </SimpleGrid>;
}