/**
 * Virtualized volume list component for efficient manga chapter display
 *
 * This module provides a virtualized list implementation that efficiently renders
 * large collections of manga volumes and their chapters. It uses windowing techniques
 * to only render volumes that are currently visible in the viewport, significantly
 * improving performance and reducing memory usage.
 *
 * Key features:
 * - Dynamic height calculation based on chapter count
 * - Smooth scrolling with overscan
 * - Memory efficient rendering
 * - Support for volume expansion/collapse
 */

import * as React from 'react';
import { useRef, useCallback, memo } from 'react';

import { Box } from '@mantine/core';
import { useVirtualizer, type Virtualizer, type VirtualItem } from '@tanstack/react-virtual';

import { VolumeChaptersTable } from '@/components/volumeChapters';
import type { ProgressMap } from '@/components/volumeChapters/hooks/reading-progress';
import type { FileVerificationMap } from '@/components/volumeChapters/utils';

import type { ID } from '../types/common';
import type { Chapter } from "@prisma/client";

/**
 * Volume tuple type representing a volume number and its chapters
 */
export type VolumeTuple = [number, Chapter[]];

/**
 * Callback types for chapter actions
 */
export type ChapterMonitoringCallback = (chapterId: ID, monitored: boolean) => void;
export type ChapterActionCallback = (chapterId: ID) => void;

/**
 * Props for the VirtualizedVolumeList component
 */
export interface VirtualizedVolumeListProps {
  /** Array of volume tuples containing volume number and chapters */
  volumes: VolumeTuple[];
  /** Callback for toggling chapter monitoring */
  onToggleMonitoring?: ChapterMonitoringCallback;
  /** Callback for initiating automatic chapter search */
  onAutoSearch?: ChapterActionCallback;
  /** Callback for initiating manual chapter search */
  onManualSearch?: ChapterActionCallback;
  /** Callback when a chapter is clicked */
  onChapterClick?: (chapter: Chapter, enrichedChapter: Chapter) => void;
  /** Callback to force refresh parent data */
  onForceRefresh?: () => void;
  /** Manga ID for queries and navigation */
  mangaId?: number;
  /** Manga title for display context */
  mangaTitle?: string;
  /** Whether all volumes are expanded */
  allExpanded: boolean;
  /** Volume titles keyed by volume number */
  volumeTitles?: Record<number, string>;
  /** Volume covers keyed by volume number */
  volumeCovers?: Record<number, string>;
  /** Enriched volume data from wizard import (titles, covers, descriptions) */
  enrichedVolumeData?: unknown[];
  /** Provider metadata for extracting chapter/volume details */
  providerMetadata?: unknown;
  /** Selected source ID for provider selection */
  selectedSourceId?: string | Record<string, unknown>;
  /** Raw provider data */
  rawProviderData?: unknown;
  /** Manga source for provider selection */
  mangaSource?: string;
  /** Parent-level progress map to avoid N+1 queries */
  parentProgressMap?: ProgressMap | undefined;
  /** Parent-level file verification to avoid N+1 queries */
  parentFileVerification?: FileVerificationMap | undefined;
}

// ============================================================================
// Helper functions (extracted to reduce nesting depth)
// ============================================================================

function extractVolumeTitle(data: unknown): string | undefined {
  if (typeof data !== 'object' || data === null) return undefined;
  const record = data as Record<string, unknown>;
  return (typeof record['title'] === 'string' ? record['title'] : undefined)
    ?? (typeof record['name'] === 'string' ? record['name'] : undefined)
    ?? (typeof record['volumeName'] === 'string' ? record['volumeName'] : undefined);
}

function extractVolumeCover(data: unknown): string | undefined {
  if (typeof data !== 'object' || data === null) return undefined;
  const record = data as Record<string, unknown>;
  return (typeof record['coverImageUrl'] === 'string' ? record['coverImageUrl'] : undefined)
    ?? (typeof record['coverUrl'] === 'string' ? record['coverUrl'] : undefined)
    ?? (typeof record['cover'] === 'string' ? record['cover'] : undefined);
}

function getSelectedSource(selectedSourceId: string | Record<string, unknown> | undefined): string | undefined {
  if (!selectedSourceId) return undefined;
  if (typeof selectedSourceId === 'string') return selectedSourceId;
  const ch = (selectedSourceId as Record<string, unknown>)['chapters'];
  return typeof ch === 'string' ? ch : undefined;
}

function findEnrichedData(enrichedVolumeData: unknown[] | undefined, volumeNumber: number): unknown | undefined {
  return enrichedVolumeData?.find((v: unknown) => {
    if (typeof v !== 'object' || v === null) return false;
    const typedV = v as Record<string, unknown>;
    const vNum = typedV['volumeNumber'];
    const num = typedV['number'];
    return (typeof vNum === 'number' && vNum === volumeNumber) ||
           (typeof num === 'number' && num === volumeNumber);
  });
}

interface VolumeItemBuildContext {
  propMangaId: number | undefined;
  mangaTitle: string | undefined;
  onToggleMonitoring: ChapterMonitoringCallback | undefined;
  onAutoSearch: ChapterActionCallback | undefined;
  onManualSearch: ChapterActionCallback | undefined;
  onChapterClick: ((chapter: Chapter, enrichedChapter: Chapter) => void) | undefined;
  onForceRefresh: (() => void) | undefined;
  volumeTitles: Record<number, string> | undefined;
  volumeCovers: Record<number, string> | undefined;
  enrichedVolumeData: unknown[] | undefined;
  providerMetadata: unknown | undefined;
  selectedSourceId: string | Record<string, unknown> | undefined;
  mangaSource: string | undefined;
  parentProgressMap: ProgressMap | undefined;
  parentFileVerification: FileVerificationMap | undefined;
}

function pickDefined(entries: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(entries)) {
    if (value !== undefined) result[key] = value;
  }
  return result;
}

function buildVolumeProps(
  volumeNumber: number,
  chapters: Chapter[],
  allExpanded: boolean,
  ctx: VolumeItemBuildContext
): Record<string, unknown> {
  const volumeSpecificData = findEnrichedData(ctx.enrichedVolumeData, volumeNumber);
  const title = volumeSpecificData ? extractVolumeTitle(volumeSpecificData) : undefined;
  const cover = volumeSpecificData ? extractVolumeCover(volumeSpecificData) : undefined;
  const source = getSelectedSource(ctx.selectedSourceId);

  return {
    volumeNumber,
    chapters,
    allExpanded,
    mangaId: ctx.propMangaId ?? chapters[0]?.mangaId ?? undefined,
    ...pickDefined({
      mangaTitle: ctx.mangaTitle,
      onToggleMonitoring: ctx.onToggleMonitoring,
      onAutoSearch: ctx.onAutoSearch,
      onManualSearch: ctx.onManualSearch,
      onChapterClick: ctx.onChapterClick,
      onForceRefresh: ctx.onForceRefresh,
      volumeTitle: ctx.volumeTitles?.[volumeNumber] ?? title,
      volumeCover: ctx.volumeCovers?.[volumeNumber] ?? cover,
      volumeData: volumeSpecificData,
      providerMetadata: ctx.providerMetadata,
      selectedSource: ctx.mangaSource ?? source,
      parentProgressMap: ctx.parentProgressMap,
      parentFileVerification: ctx.parentFileVerification,
    }),
  };
}

// ============================================================================
// Virtualized volume item renderer
// ============================================================================

function renderVolumeItem(
  virtualItem: VirtualItem,
  volumes: VolumeTuple[],
  allExpanded: boolean,
  ctx: VolumeItemBuildContext,
  measureElement: Virtualizer<HTMLDivElement, Element>['measureElement']
): React.ReactNode {
  if (virtualItem.index < 0 || virtualItem.index >= volumes.length) return null;

  const volumeData = volumes[virtualItem.index];
  if (!volumeData) return null;

  const [volumeNumber, chapters] = volumeData;
  const componentProps = buildVolumeProps(volumeNumber, chapters, allExpanded, ctx);

  return (
    <Box
      key={`volume-${volumeNumber}-${virtualItem.index}`}
      data-index={virtualItem.index}
      ref={measureElement}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        transform: `translateY(${virtualItem.start}px)`,
      }}
    >
      {React.createElement(VolumeChaptersTable, componentProps as never)}
    </Box>
  );
}

// ============================================================================
// Main component
// ============================================================================

export const VirtualizedVolumeList = memo(({
  volumes,
  onToggleMonitoring,
  onAutoSearch,
  onManualSearch,
  onChapterClick,
  onForceRefresh,
  mangaId: propMangaId,
  mangaTitle,
  allExpanded,
  volumeTitles,
  volumeCovers,
  enrichedVolumeData,
  providerMetadata,
  selectedSourceId,
  rawProviderData: _rawProviderData,
  mangaSource,
  parentProgressMap,
  parentFileVerification
}: VirtualizedVolumeListProps) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const estimateSize = useCallback((index: number): number => {
    const volumeData = volumes[index];
    if (!volumeData) return 80;

    const [, chapters] = volumeData;
    return allExpanded ? Math.min(80 + chapters.length * 40, 2000) : 80;
  }, [allExpanded, volumes]);

  // Use useVirtualizer with explicit scroll container (not useWindowVirtualizer)
  // This works correctly inside Mantine ScrollArea and other scroll containers
  const virtualizer = useVirtualizer({
    count: volumes.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize,
    overscan: 5,
  });

  const virtualItems: VirtualItem[] = virtualizer.getVirtualItems();

  // Build context once for all items
  const ctx: VolumeItemBuildContext = {
    propMangaId,
    mangaTitle,
    onToggleMonitoring,
    onAutoSearch,
    onManualSearch,
    onChapterClick,
    onForceRefresh,
    volumeTitles,
    volumeCovers,
    enrichedVolumeData,
    providerMetadata,
    selectedSourceId,
    mangaSource,
    parentProgressMap,
    parentFileVerification,
  };

  return (
    <Box
      ref={scrollContainerRef}
      data-testid="virtualized-volume-list"
      style={{
        height: 'calc(100vh - 300px)',
        width: '100%',
        overflowY: 'auto',
      }}
    >
      <Box
        style={{
          height: virtualizer.getTotalSize(),
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualItems.map((virtualItem: VirtualItem) =>
          renderVolumeItem(virtualItem, volumes, allExpanded, ctx, virtualizer.measureElement)
        )}
      </Box>
    </Box>
  );
});

VirtualizedVolumeList.displayName = 'VirtualizedVolumeList';
