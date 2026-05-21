/**
 * Optimized Chapter Section Component
 *
 * Drop-in replacement for chapter lists that automatically handles:
 * - Virtual scrolling for large manga (200+ chapters)
 * - Pagination for very large manga (500+ chapters)
 * - Performance warnings and metrics
 *
 * @module components/manga/OptimizedChapterSection
 */

import React from 'react';
import { useState } from 'react';

import { Stack, Tabs } from '@mantine/core';

import { useChapterPagination, useVirtualChapterList, useChapterPerformanceMetrics } from '@/hooks/useChapterPagination';
import type { MangaWithRelations } from '@/types/search.types';

import { LoadMoreChapters, ChapterCountSummary } from './LoadMoreChapters';
import { ResponsiveChapterList } from './ResponsiveChapterList';
import { VirtualChapterList, VirtualScrollingInfo } from './VirtualChapterList';


export interface OptimizedChapterSectionProps {
  /** Manga data with chapters */
  manga: MangaWithRelations;
  /** Out of sync chapter IDs */
  outOfSyncChapters?: (string | number)[];
  /** Download callback */
  onDownload?: (mangaId: string | number, chapterIds: (string | number)[]) => void;
  /** Other handlers from ResponsiveChapterList */
  onToggleMonitoring?: (chapterId: string | number, monitored: boolean) => void;
  onAutoSearch?: (chapterId: string | number) => void;
  onManualSearch?: (chapterId: string | number) => void;
  onRefresh?: () => void;
  /** Loading state */
  isLoading?: boolean;
}

/**
 * Automatically optimized chapter list component
 *
 * Features:
 * - Auto-detects chapter count and applies appropriate optimization
 * - Virtual scrolling for 200+ chapters
 * - Pagination for 500+ chapters
 * - Performance metrics display
 * - Seamless fallback to regular list for small manga
 *
 * Usage:
 * ```tsx
 * <OptimizedChapterSection
 *   manga={manga}
 *   outOfSyncChapters={outOfSyncIds}
 *   onDownload={handleDownload}
 * />
 * ```
 */
export function OptimizedChapterSection({
  manga,
  outOfSyncChapters = [],
  onDownload,
  onToggleMonitoring,
  onAutoSearch,
  onManualSearch,
  onRefresh,
  isLoading = false
}: OptimizedChapterSectionProps): React.ReactElement {
  const chapters = manga['Chapter'];
  const totalChapters = manga.Metadata?.chapters ?? chapters.length;
  const [activeTab, setActiveTab] = useState<string>('chapters');

  // Chapter pagination hook
  const pagination = useChapterPagination(manga.id, totalChapters, {
    initialLimit: 500,
    pageSize: 200
  });

  // Virtual scrolling detection
  const virtualScrolling = useVirtualChapterList(chapters, {
    threshold: 200,
    itemHeight: 60
  });

  // Performance metrics
  const metrics = useChapterPerformanceMetrics(chapters.length);

  // Determine which component to render
  const shouldUseVirtualScrolling: boolean = virtualScrolling.shouldUseVirtualScrolling;
  const shouldShowPagination: boolean = pagination.needsPagination && pagination.hasMore;

  return (
    <Stack gap="md">
      {/* Performance info banner */}
      {shouldUseVirtualScrolling && (
        <VirtualScrollingInfo chapterCount={chapters.length} />
      )}

      {/* Chapter count summary */}
      <ChapterCountSummary
        loadedCount={chapters.length}
        totalCount={totalChapters}
        useVirtualScrolling={shouldUseVirtualScrolling}
      />

      {/* Tabbed interface */}
      <Tabs value={activeTab} onChange={(value) => setActiveTab(value ?? 'chapters')}>
        <Tabs.List>
          <Tabs.Tab value="chapters">
            Chapters ({chapters.length})
          </Tabs.Tab>
          {metrics.isLarge && (
            <Tabs.Tab value="performance">
              Performance
            </Tabs.Tab>
          )}
        </Tabs.List>

        <Tabs.Panel value="chapters" pt="md">
          {/* Virtual scrolling for large lists */}
          {shouldUseVirtualScrolling ? (
            <VirtualChapterList
              chapters={chapters}
              itemHeight={virtualScrolling.itemHeight}
              onDownload={(chapterId) => onDownload?.(manga.id, [chapterId])}
              outOfSyncChapters={outOfSyncChapters}
              isLoading={isLoading}
            />
          ) : (
            /* Regular responsive list for smaller manga */
            <ResponsiveChapterList
              manga={manga}
              outOfSyncChapters={outOfSyncChapters}
              {...(onDownload && { onDownload })}
              {...(onToggleMonitoring && { onToggleMonitoring })}
              {...(onAutoSearch && { onAutoSearch })}
              {...(onManualSearch && { onManualSearch })}
              {...(onRefresh && { onRefresh })}
              isLoading={isLoading}
            />
          )}

          {/* Pagination controls */}
          {shouldShowPagination && (
            <LoadMoreChapters
              loadedCount={pagination.loadedCount as number}
              totalCount={pagination.totalCount as number}
              remainingCount={pagination.remainingCount as number}
              hasMore={pagination.hasMore as boolean}
              loadedPercentage={pagination.loadedPercentage as number}
              onLoadMore={pagination.loadMore as () => void}
              onLoadAll={pagination.loadAll as () => void}
              isLoading={isLoading}
            />
          )}
        </Tabs.Panel>

        {metrics.isLarge && (
          <Tabs.Panel value="performance" pt="md">
            <PerformanceMetricsPanel metrics={metrics} />
          </Tabs.Panel>
        )}
      </Tabs>
    </Stack>
  );
}

/**
 * Performance metrics display panel
 */
function PerformanceMetricsPanel({
  metrics
}: {
  metrics: ReturnType<typeof useChapterPerformanceMetrics>;
}): React.ReactElement {
  return (
    <Stack gap="md">
      <div>
        <strong>Chapter Count:</strong> {metrics.chapterCount}
      </div>
      <div>
        <strong>Performance Rating:</strong> {metrics.performanceRating}
      </div>
      <div>
        <strong>Recommendation:</strong> {metrics.recommendation}
      </div>
      <div>
        <strong>Estimated Memory Usage:</strong> {metrics.estimatedMemoryUsage}
      </div>
      {metrics.loadTime && (
        <div>
          <strong>Load Time:</strong> {metrics.loadTime}ms
        </div>
      )}
    </Stack>
  );
}

/**
 * Quick integration example:
 *
 * ```tsx
 * // In your manga detail page, replace:
 * <ResponsiveChapterList manga={manga} ... />
 *
 * // With:
 * <OptimizedChapterSection manga={manga} ... />
 * ```
 *
 * That's it! The component automatically:
 * - Detects chapter count
 * - Applies appropriate optimization
 * - Handles pagination
 * - Shows performance metrics
 * - Falls back to regular list when not needed
 */
