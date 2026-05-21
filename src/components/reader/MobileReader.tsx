/**
 * Mobile Reader Component
 *
 * Optimized manga reader for mobile devices with:
 * - Vertical scroll mode
 * - Pinch-to-zoom
 * - Swipe navigation
 * - Orientation handling
 * - Reading progress tracking
 */

import React from 'react';

import { Box } from '@mantine/core';
import { useViewportSize, useFullscreen, useHotkeys } from '@mantine/hooks';

import { useBreakpoint } from '@/hooks/mobile';
import { usePinchZoom } from '@/hooks/mobile/usePinchZoom';
import { useSwipeGesture } from '@/hooks/mobile/useSwipeGesture';
import {
  SWIPE_GESTURE_THRESHOLD,
  MIN_ZOOM_LEVEL,
  MAX_ZOOM_LEVEL,
  ZOOM_INCREMENT_STEP
} from '@/utils/reader/constants';

import { FooterControls } from './mobile-reader/FooterControls';
import { HeaderControls } from './mobile-reader/HeaderControls';
import {
  useReaderState,
  useReaderRefs,
  useScrollToPage,
  useReadingProgress,
  useControlsAutoHide,
  useNavigatePage
} from './mobile-reader/hooks';
import { PageListModal } from './mobile-reader/PageListModal';
import { ReaderSettings } from './mobile-reader/ReaderSettings';
import { renderContent, type RenderPageProps } from './mobile-reader/render-helpers';

import type { MobileReaderProps } from './mobile-reader/types';

/**
 * Mobile Reader Component
 *
 * Main component that orchestrates all mobile reading functionality
 *
 * @param props - MobileReaderProps
 * @returns React element for the mobile reader
 */
export function MobileReader({
  chapter,
  currentPage,
  mode = 'vertical',
  direction = 'ltr',
  onPageChange,
  onChapterChange,
  showControls = true,
  header,
  footer,
  hapticFeedback = true
}: MobileReaderProps): React.ReactElement {
  // Viewport and fullscreen
  const { isMobile } = useBreakpoint();
  const { height: viewportHeight, width: viewportWidth } = useViewportSize();
  const { ref: fullscreenRef, toggle: toggleFullscreen } = useFullscreen();

  // State management (from extracted hooks)
  const state = useReaderState(showControls);
  const refs = useReaderRefs();

  // Effects (from extracted hooks)
  useScrollToPage(currentPage, mode, refs.pagesRef);
  useReadingProgress(currentPage, state.setReadingProgress);
  useControlsAutoHide(showControls, state.setControlsVisible, refs.controlsTimeoutRef);

  // Navigation (from extracted hook)
  const navigatePage = useNavigatePage({
    currentPage,
    chapter,
    onPageChange,
    onChapterChange,
    hapticFeedback
  });

  // Gesture handlers
  const { handlers: swipeHandlers } = useSwipeGesture({
    onSwipeLeft: () => navigatePage(direction === 'ltr' ? 'next' : 'prev'),
    onSwipeRight: () => navigatePage(direction === 'ltr' ? 'prev' : 'next'),
    threshold: SWIPE_GESTURE_THRESHOLD
  });

  const { handlers: pinchHandlers, scale } = usePinchZoom({
    minScale: MIN_ZOOM_LEVEL,
    maxScale: MAX_ZOOM_LEVEL,
    onScaleChange: state.setZoom
  });

  // Keyboard navigation
  useHotkeys([
    ['ArrowLeft', () => navigatePage('prev')],
    ['ArrowRight', () => navigatePage('next')],
    ['Space', () => navigatePage('next')],
    ['f', toggleFullscreen],
    ['+', () => state.setZoom((z) => Math.min(z + ZOOM_INCREMENT_STEP, MAX_ZOOM_LEVEL))],
    ['-', () => state.setZoom((z) => Math.max(z - ZOOM_INCREMENT_STEP, MIN_ZOOM_LEVEL))],
    ['0', () => state.setZoom(1)]
  ]);

  // Prepare props for render helpers
  const renderProps: RenderPageProps = {
    chapter,
    currentPage,
    zoom: state.zoom,
    scale,
    controlsVisible: state.controlsVisible,
    direction,
    viewportHeight,
    viewportWidth,
    isMobile,
    swipeHandlers,
    pinchHandlers,
    pagesRef: refs.pagesRef,
    onPageChange
  };

  return (
    <Box
      ref={fullscreenRef}
      style={{
        height: '100vh',
        width: '100vw',
        backgroundColor: 'black',
        position: 'relative',
        overflow: 'hidden'
      }}
      onClick={() => {
        if (showControls) {
          state.setControlsVisible(!state.controlsVisible);
        }
      }}>

      {/* Content */}
      <Box ref={refs.containerRef} style={{ height: '100%', width: '100%' }}>
        {renderContent(mode, renderProps)}
      </Box>

      {/* Header Controls */}
      {state.controlsVisible &&
        <HeaderControls
          chapterTitle={chapter.title}
          onShowPageList={(): void => state.setShowPageList(true)}
          onShowSettings={(): void => state.setShowSettings(true)}
          onToggleFullscreen={(): void => { void toggleFullscreen(); }}
          customHeader={header}
        />
      }

      {/* Footer Controls */}
      {state.controlsVisible && mode !== 'vertical' &&
        <FooterControls
          currentPage={currentPage}
          totalPages={chapter.pages.length}
          canGoPrev={currentPage > 0 || !!onChapterChange}
          canGoNext={currentPage < chapter.pages.length - 1 || !!onChapterChange}
          zoom={state.zoom}
          onNavigatePrev={(): void => { void navigatePage('prev'); }}
          onNavigateNext={(): void => { void navigatePage('next'); }}
          onPageChange={onPageChange}
          onZoomIn={(): void => state.setZoom((z) => Math.min(z + ZOOM_INCREMENT_STEP, MAX_ZOOM_LEVEL))}
          onZoomOut={(): void => state.setZoom((z) => Math.max(z - ZOOM_INCREMENT_STEP, MIN_ZOOM_LEVEL))}
          customFooter={footer}
        />
      }

      {/* Settings Modal */}
      <ReaderSettings
        opened={state.showSettings}
        onClose={() => state.setShowSettings(false)}
        mode={mode}
        direction={direction}
        zoom={state.zoom}
        onModeChange={(_newMode) => {
          // Handle mode change
          state.setShowSettings(false);
        }}
        onDirectionChange={(_newDirection) => {
          // Handle direction change
          state.setShowSettings(false);
        }}
        onZoomChange={state.setZoom} />

      {/* Page List Modal */}
      <PageListModal
        opened={state.showPageList}
        onClose={() => state.setShowPageList(false)}
        pages={chapter.pages}
        currentPage={currentPage}
        readingProgress={state.readingProgress}
        onPageSelect={(page) => {
          onPageChange(page);
          state.setShowPageList(false);
        }} />
    </Box>
  );
}

// Re-export types for convenience
export type { ReaderPage, ReaderChapter, MobileReaderProps } from './mobile-reader/types';
