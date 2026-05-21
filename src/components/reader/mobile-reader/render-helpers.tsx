/**
 * Mobile Reader Render Helpers
 *
 * Render functions for different reading modes (single, vertical, double page).
 *
 * Extracted from: MobileReader.tsx
 * Purpose: Provide rendering logic for various reading modes
 */

import React from 'react';

import { Box, Stack, Group, ScrollArea } from '@mantine/core';

import { ProgressiveImage } from '@/components/images/ProgressiveImage';
import type { PinchZoomHandlers } from '@/hooks/mobile/usePinchZoom';
import type { SwipeGestureHandlers } from '@/hooks/mobile/useSwipeGesture';

import type { ReaderChapter, ReadingMode, ReadingDirection } from './types';

// ============================================================================
// Render Helper Props
// ============================================================================

/**
 * Props for render helper functions
 *
 * Contains all data needed to render pages in different reading modes
 */
export interface RenderPageProps {
  /** Current chapter being read */
  chapter: ReaderChapter;
  /** Current page index (0-based) */
  currentPage: number;
  /** Zoom level (1 = 100%) */
  zoom: number;
  /** Pinch zoom scale factor */
  scale: number;
  /** Whether controls UI is visible */
  controlsVisible: boolean;
  /** Reading direction (left-to-right or right-to-left) */
  direction: ReadingDirection;
  /** Viewport height in pixels */
  viewportHeight: number;
  /** Viewport width in pixels */
  viewportWidth: number;
  /** Whether device is mobile */
  isMobile: boolean;
  /** Swipe gesture handlers */
  swipeHandlers: SwipeGestureHandlers;
  /** Pinch zoom gesture handlers */
  pinchHandlers: PinchZoomHandlers;
  /** Refs to page elements for scroll tracking */
  pagesRef: React.RefObject<(HTMLDivElement | null)[]>;
  /** Callback when page changes */
  onPageChange: (page: number) => void;
}

// ============================================================================
// Single Page Mode
// ============================================================================

/**
 * Renders a single page with zoom and pinch support
 *
 * Features:
 * - Full viewport display
 * - Pinch-to-zoom
 * - Swipe navigation
 * - Progressive image loading
 *
 * @param props - Render page props
 * @returns Single page render or null if page doesn't exist
 */
export function renderSinglePage(props: RenderPageProps): React.ReactElement | null {
  const {
    chapter,
    currentPage,
    zoom,
    scale,
    controlsVisible,
    swipeHandlers,
    pinchHandlers
  } = props;

  const page = chapter.pages[currentPage];
  if (!page) return null;

  return (
    <Box
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden'
      }}
      {...swipeHandlers}
      {...pinchHandlers}>

      <Box
        style={{
          transform: `scale(${zoom * scale})`,
          transformOrigin: 'center',
          transition: 'transform 0.2s ease',
          maxWidth: '100%',
          maxHeight: '100%'
        }}>

        <ProgressiveImage
          src={page.url}
          {...(page.thumbnailUrl && { placeholder: page.thumbnailUrl })}
          alt={`Page ${page.pageNumber}`}
          style={{
            maxWidth: '100vw',
            maxHeight: `calc(100vh - ${controlsVisible ? 120 : 0}px)`,
            objectFit: 'contain'
          }} />

      </Box>
    </Box>
  );
}

// ============================================================================
// Vertical Scroll Mode
// ============================================================================

/**
 * Renders all pages in a vertical scrollable list
 *
 * Features:
 * - Continuous scrolling
 * - Automatic page tracking based on scroll position
 * - Lazy loading for off-screen pages
 * - Alternating background colors for visual separation
 *
 * @param props - Render page props
 * @returns Vertical scroll view with all pages
 */
export function renderVerticalScroll(props: RenderPageProps): React.ReactElement {
  const {
    chapter,
    currentPage,
    viewportHeight,
    pagesRef,
    onPageChange
  } = props;

  return (
    <ScrollArea
      style={{
        height: '100%',
        width: '100%'
      }}
      onScroll={(e) => {
        const target = e.target as HTMLElement;
        const scrollTop = target.scrollTop;

        // Find current page based on scroll position
        let currentIndex = 0;
        if (pagesRef.current) {
          for (let i = 0; i < pagesRef.current.length; i++) {
            const pageEl = pagesRef.current[i];
            if (pageEl && pageEl.offsetTop > scrollTop + viewportHeight / 2) {
              break;
            }
            currentIndex = i;
          }
        }

        if (currentIndex !== currentPage) {
          onPageChange(currentIndex);
        }
      }}>

      <Stack gap={0}>
        {chapter.pages.map((page, index) =>
          <Box
            key={page.id}
            ref={(el) => { if (pagesRef.current) pagesRef.current[index] = el; }}
            style={{
              width: '100%',
              minHeight: viewportHeight,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: index % 2 === 0 ? 'transparent' : 'var(--mantine-color-gray-0)'
            }}>

            <ProgressiveImage
              src={page.url}
              {...(page.thumbnailUrl && { placeholder: page.thumbnailUrl })}
              alt={`Page ${page.pageNumber}`}
              style={{
                width: '100%',
                height: 'auto',
                maxWidth: '100vw'
              }}
              lazy={Math.abs(index - currentPage) > 2} />

          </Box>
        )}
      </Stack>
    </ScrollArea>
  );
}

// ============================================================================
// Double Page Mode
// ============================================================================

/**
 * Renders two pages side-by-side in landscape orientation
 *
 * Features:
 * - Two-page spread for landscape mode
 * - Respects reading direction (LTR/RTL)
 * - Falls back to single page on mobile or portrait
 * - Swipe navigation between spreads
 *
 * @param props - Render page props
 * @returns Double page spread or single page fallback
 */
export function renderDoublePage(props: RenderPageProps): React.ReactElement | null {
  const {
    chapter,
    currentPage,
    direction,
    viewportHeight,
    viewportWidth,
    isMobile,
    swipeHandlers
  } = props;

  const isLandscape = viewportWidth > viewportHeight;
  if (!isLandscape || isMobile) {
    return renderSinglePage(props);
  }

  const leftIndex = direction === 'ltr' ? currentPage : currentPage + 1;
  const rightIndex = direction === 'ltr' ? currentPage + 1 : currentPage;

  const leftPage = chapter.pages[leftIndex];
  const rightPage = chapter.pages[rightIndex];

  return (
    <Group gap={0} style={{ height: '100%' }} {...swipeHandlers}>
      <Box style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {leftPage &&
          <ProgressiveImage
            src={leftPage.url}
            {...(leftPage.thumbnailUrl && { placeholder: leftPage.thumbnailUrl })}
            alt={`Page ${leftPage.pageNumber}`}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain'
            }} />
        }
      </Box>
      <Box style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {rightPage &&
          <ProgressiveImage
            src={rightPage.url}
            {...(rightPage.thumbnailUrl && { placeholder: rightPage.thumbnailUrl })}
            alt={`Page ${rightPage.pageNumber}`}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain'
            }} />
        }
      </Box>
    </Group>
  );
}

// ============================================================================
// Mode Switcher
// ============================================================================

/**
 * Renders content based on the current reading mode
 *
 * Delegates to the appropriate render function based on mode:
 * - 'vertical': Continuous scrolling view
 * - 'double': Two-page spread
 * - 'single': Single page view (default)
 *
 * @param mode - Current reading mode
 * @param props - Render page props
 * @returns Rendered content for the selected mode
 */
export function renderContent(mode: ReadingMode, props: RenderPageProps): React.ReactElement | null {
  switch (mode) {
    case 'vertical':
      return renderVerticalScroll(props);
    case 'double':
      return renderDoublePage(props);
    case 'single':
    default:
      return renderSinglePage(props);
  }
}
