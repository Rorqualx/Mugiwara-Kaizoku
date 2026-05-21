/**
 * Mobile Reader Custom Hooks
 *
 * React hooks for managing mobile reader state, effects, and behaviors.
 *
 * Extracted from: MobileReader.tsx
 */

import { useState, useRef, useCallback, useEffect, type RefObject, type Dispatch, type SetStateAction } from 'react';

import {
  CONTROLS_AUTO_HIDE_DELAY_MS,
  HAPTIC_FEEDBACK_DURATION_MS
} from '@/utils/reader/constants';

import type { ReaderChapter, NavigationDirection } from './types';

// ============================================================================
// State Management Hooks
// ============================================================================

/**
 * State object returned by useReaderState
 */
export interface ReaderState {
  zoom: number;
  showSettings: boolean;
  showPageList: boolean;
  controlsVisible: boolean;
  readingProgress: Set<number>;
  setZoom: Dispatch<SetStateAction<number>>;
  setShowSettings: Dispatch<SetStateAction<boolean>>;
  setShowPageList: Dispatch<SetStateAction<boolean>>;
  setControlsVisible: Dispatch<SetStateAction<boolean>>;
  setReadingProgress: Dispatch<SetStateAction<Set<number>>>;
}

/**
 * Manages all state for the mobile reader
 *
 * @param showControls - Initial visibility of controls
 * @returns State object with all state values and setters
 */
export function useReaderState(showControls: boolean): ReaderState {
  const [zoom, setZoom] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  const [showPageList, setShowPageList] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(showControls);
  const [readingProgress, setReadingProgress] = useState<Set<number>>(new Set());

  return {
    zoom,
    showSettings,
    showPageList,
    controlsVisible,
    readingProgress,
    setZoom,
    setShowSettings,
    setShowPageList,
    setControlsVisible,
    setReadingProgress
  };
}

// ============================================================================
// Ref Management Hooks
// ============================================================================

/**
 * Refs object returned by useReaderRefs
 */
export interface ReaderRefs {
  containerRef: RefObject<HTMLDivElement>;
  pagesRef: RefObject<(HTMLDivElement | null)[]>;
  controlsTimeoutRef: { current: NodeJS.Timeout | undefined };
}

/**
 * Manages all refs for the mobile reader
 *
 * @returns Refs object with container, pages, and timeout refs
 */
export function useReaderRefs(): ReaderRefs {
  const containerRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<(HTMLDivElement | null)[]>([]);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  return {
    containerRef,
    pagesRef,
    controlsTimeoutRef
  };
}

// ============================================================================
// Effect Hooks
// ============================================================================

/**
 * Scrolls to the current page when it changes in vertical mode
 *
 * @param currentPage - Current page index
 * @param mode - Reading mode
 * @param pagesRef - Ref to page elements array
 */
export function useScrollToPage(
  currentPage: number,
  mode: 'vertical' | 'single' | 'double',
  pagesRef: RefObject<(HTMLDivElement | null)[]>
): void {
  useEffect(() => {
    if (mode === 'vertical') {
      const pageElement = pagesRef.current?.[currentPage];
      if (pageElement) {
        pageElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [currentPage, mode, pagesRef]);
}

/**
 * Tracks reading progress by adding viewed pages to the progress set
 *
 * @param currentPage - Current page index
 * @param setReadingProgress - State setter for reading progress
 */
export function useReadingProgress(
  currentPage: number,
  setReadingProgress: Dispatch<SetStateAction<Set<number>>>
): void {
  useEffect(() => {
    setReadingProgress((prev) => {
      const newSet = new Set(prev);
      newSet.add(currentPage);
      return newSet;
    });
  }, [currentPage, setReadingProgress]);
}

/**
 * Auto-hides controls after a delay when enabled
 *
 * @param showControls - Whether controls should be shown
 * @param setControlsVisible - State setter for controls visibility
 * @param controlsTimeoutRef - Ref to timeout ID
 */
export function useControlsAutoHide(
  showControls: boolean,
  setControlsVisible: Dispatch<SetStateAction<boolean>>,
  controlsTimeoutRef: { current: NodeJS.Timeout | undefined }
): void {
  useEffect(() => {
    if (!showControls) return;

    const hideControls = (): NodeJS.Timeout => {
      return setTimeout(() => {
        setControlsVisible(false);
      }, CONTROLS_AUTO_HIDE_DELAY_MS);
    };

    const _showControlsTemporarily = (): void => {
      setControlsVisible(true);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      // eslint-disable-next-line no-param-reassign
      controlsTimeoutRef.current = hideControls();
    };

    // eslint-disable-next-line no-param-reassign
    controlsTimeoutRef.current = hideControls();

    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [showControls, setControlsVisible, controlsTimeoutRef]);
}

// ============================================================================
// Callback Hooks
// ============================================================================

/**
 * Navigation callback function signature
 */
export type NavigatePageFn = (direction: NavigationDirection) => void;

/**
 * Parameters for useNavigatePage hook
 */
export interface UseNavigatePageParams {
  currentPage: number;
  chapter: ReaderChapter;
  onPageChange: (page: number) => void;
  onChapterChange?: ((direction: NavigationDirection) => void) | undefined;
  hapticFeedback?: boolean | undefined;
}

/**
 * Creates a callback for navigating between pages with chapter transition support
 *
 * @param params - Configuration parameters
 * @returns Navigation callback function
 */
export function useNavigatePage({
  currentPage,
  chapter,
  onPageChange,
  onChapterChange,
  hapticFeedback = true
}: UseNavigatePageParams): NavigatePageFn {
  return useCallback((direction: NavigationDirection) => {
    let newPage: number;

    if (direction === 'prev') {
      newPage = currentPage > 0 ? currentPage - 1 : currentPage;

      // Navigate to previous chapter if at first page
      if (newPage === currentPage && onChapterChange) {
        onChapterChange('prev');
        return;
      }
    } else {
      newPage = currentPage < chapter.pages.length - 1 ? currentPage + 1 : currentPage;

      // Navigate to next chapter if at last page
      if (newPage === currentPage && onChapterChange) {
        onChapterChange('next');
        return;
      }
    }

    onPageChange(newPage);

    // Haptic feedback
    if (hapticFeedback && 'vibrate' in navigator) {
      navigator.vibrate(HAPTIC_FEEDBACK_DURATION_MS);
    }
  }, [currentPage, chapter.pages.length, onPageChange, onChapterChange, hapticFeedback]);
}
