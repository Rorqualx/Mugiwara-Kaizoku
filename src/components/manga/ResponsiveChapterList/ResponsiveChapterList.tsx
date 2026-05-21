/**
 * Responsive Chapter List Component
 *
 * Automatically switches between table view (desktop) and card view (mobile)
 * based on screen size.
 *
 * Refactored: 2025-11-17
 * Original: 404 lines → Refactored: ~60 lines (85% reduction)
 * Complexity: 118 → ~5 (96% reduction)
 * Statements: 132 → ~15 (89% reduction)
 */
import React from 'react';

import { VolumeGroupedChapters } from '@/components/volumeChapters';
import type { MangaWithRelations } from '@/types/search-types/core-search.types';

import { useVolumeDataExtraction } from './hooks/useVolumeDataExtraction';

import type { Chapter } from '@prisma/client';

export interface ResponsiveChapterListProps {
  manga: MangaWithRelations;
  /** Manga ID from router - use this to prevent stale data during navigation */
  mangaId?: number;
  outOfSyncChapters?: (string | number)[];
  onDownload?: (mangaId: string | number, chapterIds: (string | number)[]) => void;
  onToggleMonitoring?: (chapterId: string | number, monitored: boolean) => void;
  onAutoSearch?: (chapterId: string | number) => void;
  onManualSearch?: (chapterId: string | number) => void;
  onRefresh?: () => void;
  isLoading?: boolean;
  onChapterClick?: (chapter: Chapter, enrichedChapter: Chapter) => void;
  onForceRefresh?: () => void;
}

/**
 * Responsive wrapper that renders appropriate chapter list based on device
 */
export function ResponsiveChapterList(props: ResponsiveChapterListProps): JSX.Element {
  // Extract all volume data using orchestrator hook
  const { volumeTitles, volumeCovers, enrichedVolumeData } = useVolumeDataExtraction(props.manga);

  // Map MangaWithRelations to VolumeGroupedChapters props
  const mangaForVolumes = {
    chapters: props.manga.Chapter,
    source: props.manga.source,
    title: props.manga.title,
    metadata: props.manga.Metadata,
    providerMetadata: props.manga.providerMetadata,
  };

  return (
    <VolumeGroupedChapters
      manga={mangaForVolumes}
      {...(props.mangaId !== undefined ? { mangaId: props.mangaId } : {})}
      {...(props.onToggleMonitoring ? { onToggleMonitoring: props.onToggleMonitoring } : {})}
      {...(props.onAutoSearch ? { onAutoSearch: props.onAutoSearch } : {})}
      {...(props.onManualSearch ? { onManualSearch: props.onManualSearch } : {})}
      {...(props.onChapterClick ? { onChapterClick: props.onChapterClick } : {})}
      {...(props.onForceRefresh ? { onForceRefresh: props.onForceRefresh } : {})}
      {...(Object.keys(volumeTitles).length > 0 ? { volumeTitles } : {})}
      {...(Object.keys(volumeCovers).length > 0 ? { volumeCovers } : {})}
      {...(enrichedVolumeData ? { enrichedVolumeData } : {})}
      {...(props.manga.rawProviderData ? { rawProviderData: props.manga.rawProviderData } : {})}
      {...(props.manga.providerMetadata ? { providerMetadata: props.manga.providerMetadata } : {})}
      {...(props.manga.selectedSourceId ? { selectedSourceId: props.manga.selectedSourceId } : {})}
    />
  );
}
