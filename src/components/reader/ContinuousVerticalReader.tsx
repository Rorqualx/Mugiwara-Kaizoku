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

interface IntersectionResult {
  visible: number[];
  pagesToLoad: number[];
}

/**
 * Process intersection observer entries and compute visible pages and pages to preload.
 * Extracted to reduce nesting depth in the observer callback.
 */
function processIntersectionEntries(
  entries: IntersectionObserverEntry[],
  preloadRange: number,
  totalPages: number
): IntersectionResult {
  const visible: number[] = [];
  const pagesToLoad: number[] = [];

  for (const entry of entries) {
    if (!entry.isIntersecting) continue;

    const pageNum = parseInt(entry.target.getAttribute('data-page') ?? '0');
    visible.push(pageNum);

    // Collect pages to preload around the visible page
    const startPage = Math.max(1, pageNum - preloadRange);
    const endPage = Math.min(totalPages, pageNum + preloadRange);
    for (let i = startPage; i <= endPage; i++) {
      pagesToLoad.push(i);
    }
  }

  return { visible, pagesToLoad };
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
  const [_visiblePages, setVisiblePages] = useState<number[]>([]);
  const observerRef = useRef<IntersectionObserver | null>(null);

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
    if (!containerRef.current) return;

    const preloadRange = settings.preloadPages || 2;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const { visible, pagesToLoad } = processIntersectionEntries(entries, preloadRange, totalPages);

        // Single batched state update for all pages to load
        if (pagesToLoad.length > 0) {
          setLoadedPages(prev => {
            const next = new Set(prev);
            for (const page of pagesToLoad) {
              next.add(page);
            }
            return next;
          });
        }

        if (visible.length > 0) {
          setVisiblePages(visible.sort((a, b) => a - b));
          // Update current page to the first visible page
          const newPage = Math.min(...visible);
          if (newPage !== currentPage) {
            onPageChange(newPage);
          }
        }
      },
      {
        root: containerRef.current,
        rootMargin: INTERSECTION_OBSERVER_MARGIN,
        threshold: INTERSECTION_OBSERVER_THRESHOLD
      }
    );

    // Observe all page elements
    const pageElements = containerRef.current.querySelectorAll('[data-page]');
    pageElements.forEach((el) => observerRef.current?.observe(el));

    return () => {
      observerRef.current?.disconnect();
    };
  }, [totalPages, settings.preloadPages, currentPage, onPageChange]);

  // Scroll to specific page when currentPage changes externally
  useEffect(() => {
    if (!containerRef.current) return;

    const pageElement = containerRef.current.querySelector(`[data-page="${currentPage}"]`);
    if (pageElement) {
      pageElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [currentPage]);

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
