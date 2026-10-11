// Continuous Vertical Reader - Webtoon-style scrolling
import React, { useEffect, useRef, useState } from 'react';

import { Box, Stack, Text } from '@mantine/core';

import { ProgressiveImage } from '@/components/images/ProgressiveImage';
import type { ReaderSettings } from '@/types/reader/reader-types';
import {
  CONTENT_VISIBILITY_THRESHOLD,
  INITIAL_PRELOAD_COUNT,
  INTERSECTION_OBSERVER_MARGIN,
  INTERSECTION_OBSERVER_THRESHOLD,
  PAGE_CONTAINER_MIN_HEIGHT,
  PAGE_INDICATOR_BOTTOM,
  PAGE_INDICATOR_RIGHT,
  PAGE_INDICATOR_PADDING_Y,
  PAGE_INDICATOR_PADDING_X,
  PAGE_INDICATOR_BORDER_RADIUS,
  PAGE_INDICATOR_FONT_SIZE
} from '@/utils/reader/constants';

import { PageErrorOverlay } from './PageErrorOverlay';

/** How long a code-initiated smooth scroll is given to reach its page. */
const PROGRAMMATIC_SCROLL_SETTLE_MS = 1500;

/**
 * Applies a batch of intersection changes: updates the set of on-screen pages
 * in place and returns the pages to preload around the ones that came into view.
 * Extracted to reduce nesting depth in the observer callback.
 */
function processIntersectionEntries(
  entries: IntersectionObserverEntry[],
  preloadRange: number,
  totalPages: number,
  intersecting: Set<number>
): number[] {
  const pagesToLoad: number[] = [];

  for (const entry of entries) {
    const pageNum = parseInt(entry.target.getAttribute('data-page') ?? '0', 10);
    if (!entry.isIntersecting) {
      intersecting.delete(pageNum);
      continue;
    }
    intersecting.add(pageNum);

    // Collect pages to preload around the visible page
    const startPage = Math.max(1, pageNum - preloadRange);
    const endPage = Math.min(totalPages, pageNum + preloadRange);
    for (let i = startPage; i <= endPage; i++) {
      pagesToLoad.push(i);
    }
  }

  return pagesToLoad;
}

/**
 * Wrapper around ProgressiveImage that adds retry-on-error via cache busting.
 */
function RetryablePageImage({
  src,
  pageNum,
  settings,
}: {
  src: string;
  pageNum: number;
  settings: ReaderSettings;
}): React.JSX.Element {
  const [hasError, setHasError] = React.useState(false);
  const [retryKey, setRetryKey] = React.useState(0);

  // Reset error state when src changes
  React.useEffect(() => {
    setHasError(false);
    setRetryKey(0);
  }, [src]);

  if (hasError) {
    return (
      <PageErrorOverlay
        pageNumber={pageNum}
        backgroundColor={settings.backgroundColor}
        onRetry={() => {
          setHasError(false);
          setRetryKey(prev => prev + 1);
        }}
      />
    );
  }

  const retrySrc = retryKey > 0 ? `${src}?retry=${retryKey}` : src;

  return (
    <ProgressiveImage
      key={retryKey}
      src={retrySrc}
      loadingType="skeleton"
      lazy={false}
      alt={`Page ${pageNum}`}
      onError={() => setHasError(true)}
      style={{
        maxWidth: '100%',
        width: 'auto',
        height: 'auto',
        display: 'block',
        filter: `brightness(${settings.brightness}) contrast(${settings.contrast})`,
      }}
    />
  );
}

interface ContinuousVerticalReaderProps {
  totalPages: number;
  currentPage: number;
  getPageUrl: (pageNumber: number) => string | null;
  settings: ReaderSettings;
  onPageChange: (page: number) => void;
}

export const ContinuousVerticalReader = React.memo(function ContinuousVerticalReader({
  totalPages,
  currentPage,
  getPageUrl,
  settings,
  onPageChange
}: ContinuousVerticalReaderProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loadedPages, setLoadedPages] = useState<Set<number>>(new Set([1]));

  // Latest props for the observer callback. The observer is created once per
  // chapter; reading these through refs keeps it from being torn down and
  // re-attached to every page element on each page change or parent render.
  const currentPageRef = useRef(currentPage);
  const onPageChangeRef = useRef(onPageChange);
  currentPageRef.current = currentPage;
  onPageChangeRef.current = onPageChange;

  /** Pages currently on screen. The observer only reports changes, so the full set is kept here. */
  const intersectingRef = useRef<Set<number>>(new Set());
  /** Page the user reached by scrolling; the scroll effect must not scroll to it again. */
  const scrollDerivedPageRef = useRef<number | null>(null);
  /** Page being scrolled to by code; scroll-derived page changes are ignored until it is on screen. */
  const scrollTargetRef = useRef<number | null>(null);
  const scrollTargetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load initial pages
  useEffect(() => {
    const initialPages = new Set<number>();
    for (let i = 1; i <= Math.min(INITIAL_PRELOAD_COUNT, totalPages); i++) {
      initialPages.add(i);
    }
    setLoadedPages(initialPages);
  }, [totalPages]);

  // Setup intersection observer for lazy loading and page tracking
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 0 is a valid setting (load only what is on screen); `|| 2` used to turn it into 2.
    const preloadRange = settings.preloadPages;
    const intersecting = intersectingRef.current;
    intersecting.clear();

    const observer = new IntersectionObserver(
      (entries) => {
        const pagesToLoad = processIntersectionEntries(entries, preloadRange, totalPages, intersecting);

        // Single batched state update for all pages to load
        setLoadedPages(prev => {
          if (pagesToLoad.every(page => prev.has(page))) return prev;
          const next = new Set(prev);
          for (const page of pagesToLoad) {
            next.add(page);
          }
          return next;
        });

        if (intersecting.size === 0) return;

        // A jump started by the toolbar/keyboard/saved progress is still in
        // flight: pages passing through the viewport are not "where the user
        // is", so do not report them.
        const target = scrollTargetRef.current;
        if (target !== null) {
          if (intersecting.has(target)) scrollTargetRef.current = null;
          return;
        }

        // Update current page to the first visible page
        const firstVisible = Math.min(...intersecting);
        if (firstVisible !== currentPageRef.current) {
          scrollDerivedPageRef.current = firstVisible;
          onPageChangeRef.current(firstVisible);
        }
      },
      {
        root: container,
        rootMargin: INTERSECTION_OBSERVER_MARGIN,
        threshold: INTERSECTION_OBSERVER_THRESHOLD
      }
    );

    // Observe all page elements
    container.querySelectorAll('[data-page]').forEach((el) => observer.observe(el));

    return () => {
      observer.disconnect();
    };
  }, [totalPages, settings.preloadPages]);

  // Scroll to a page when currentPage changes from OUTSIDE (toolbar, keyboard,
  // restored progress). A change that came from the user's own scrolling is
  // skipped: scrolling to the top of the page they just scrolled onto yanked
  // the view away from where they were reading.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (scrollDerivedPageRef.current === currentPage) {
      scrollDerivedPageRef.current = null;
      return;
    }
    scrollDerivedPageRef.current = null;

    const pageElement = container.querySelector(`[data-page="${currentPage}"]`);
    if (!pageElement) return;

    scrollTargetRef.current = currentPage;
    if (scrollTargetTimerRef.current !== null) clearTimeout(scrollTargetTimerRef.current);
    // Safety net: a page too tall to ever reach the visibility threshold would
    // otherwise leave scroll tracking switched off.
    scrollTargetTimerRef.current = setTimeout(() => {
      scrollTargetTimerRef.current = null;
      scrollTargetRef.current = null;
    }, PROGRAMMATIC_SCROLL_SETTLE_MS);
    pageElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [currentPage]);

  useEffect(() => {
    return () => {
      if (scrollTargetTimerRef.current !== null) clearTimeout(scrollTargetTimerRef.current);
    };
  }, []);

  return (
    <Box
      ref={containerRef}
      style={{
        height: '100%',
        overflowY: 'auto',
        overflowX: 'hidden',
        backgroundColor: settings.backgroundColor,
        scrollBehavior: settings.smoothScrolling ? 'smooth' : 'auto'
      }}
    >
      <Stack gap={0} align="center">
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
          const shouldLoad = loadedPages.has(pageNum);
          const pageUrl = shouldLoad ? getPageUrl(pageNum) : null;

          // Use content-visibility for off-screen pages to skip rendering
          const isOffscreen = Math.abs(pageNum - currentPage) > CONTENT_VISIBILITY_THRESHOLD;

          return (
            <Box
              key={pageNum}
              data-page={pageNum}
              style={{
                minHeight: PAGE_CONTAINER_MIN_HEIGHT,
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                // Performance optimization: skip rendering of off-screen pages
                contentVisibility: isOffscreen ? 'auto' : 'visible',
                containIntrinsicSize: isOffscreen ? `100% ${PAGE_CONTAINER_MIN_HEIGHT}` : undefined
              }}
            >
              {!shouldLoad && (
                <Text c="dimmed" size="sm">
                  Page {pageNum}
                </Text>
              )}

              {shouldLoad && pageUrl && (
                <RetryablePageImage
                  src={pageUrl}
                  pageNum={pageNum}
                  settings={settings}
                />
              )}

              {/* Page number indicator */}
              <Box
                style={{
                  position: 'absolute',
                  bottom: PAGE_INDICATOR_BOTTOM,
                  right: PAGE_INDICATOR_RIGHT,
                  backgroundColor: 'rgba(0, 0, 0, 0.7)',
                  color: 'white',
                  padding: `${PAGE_INDICATOR_PADDING_Y} ${PAGE_INDICATOR_PADDING_X}`,
                  borderRadius: PAGE_INDICATOR_BORDER_RADIUS,
                  fontSize: PAGE_INDICATOR_FONT_SIZE,
                  fontWeight: 500
                }}
              >
                {pageNum}
              </Box>
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
});

ContinuousVerticalReader.displayName = 'ContinuousVerticalReader';
