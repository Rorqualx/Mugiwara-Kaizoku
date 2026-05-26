/**
 * MangaBannerSection Types Module
 *
 * Shared type definitions and interfaces for all MangaBannerSection components.
 * This is the foundation module that other modules depend on.
 *
 * Extracted from: MangaBannerSection.tsx (lines 57-114)
 *
 * @module components/manga/MangaBannerSection/types
 */

import type { MangaMetadata } from '@/types/search-types/core-search.types';
import type { MangaWithRelations } from '@/types/search.types';

// Re-export for convenience across the module
export type { MangaMetadata, MangaWithRelations };

/**
 * External link structure for provider links
 *
 * Used in the external links section to render
 * clickable provider buttons
 */
export interface ExternalLink {
  /** The URL to link to */
  url: string;
  /** The site/provider name (e.g., "AniList", "MyAnimeList") */
  site: string;
  /** Optional display label (falls back to site name) */
  label?: string;
}

/**
 * Props for MangaBannerSection component
 *
 * This interface defines all the props needed by the MangaBannerSection
 * component and its sub-components.
 */
export interface MangaBannerSectionProps {
  /** The manga data to display */
  manga: MangaWithRelations;
  /** Extracted metadata from the manga */
  extractedMetadata: MangaMetadata | null;
  /** The manga ID */
  mangaId: number | null;
  /** Whether providers section is expanded */
  isProvidersExpanded: boolean;
  /** Handler to toggle providers expansion */
  setIsProvidersExpanded: (expanded: boolean) => void;
  /** Handler to open cover selector */
  setIsCoverSelectorOpen: (open: boolean) => void;
  /** Handler to open AniList bind modal */
  setIsAniListModalOpen: (open: boolean) => void;
  /** Handler to open ComicVine bind modal */
  setIsComicVineModalOpen: (open: boolean) => void;
  /** Handler to open Fandom bind modal */
  setIsFandomModalOpen: (open: boolean) => void;
  /** Handler to open Wikipedia bind modal */
  setIsWikipediaModalOpen: (open: boolean) => void;
  /** Handler to open MangaDex bind modal */
  setIsMangaDexModalOpen: (open: boolean) => void;
  /** Handler to open MangaUpdates bind modal */
  setIsMangaUpdatesModalOpen: (open: boolean) => void;
  /** Handler to open MyAnimeList bind modal */
  setIsMalModalOpen: (open: boolean) => void;
  /** Handler to open Kitsu bind modal */
  setIsKitsuModalOpen: (open: boolean) => void;
  /** Whether all chapters are monitored */
  allMonitored: boolean | null;
  /** Whether some chapters are monitored */
  someMonitored: boolean;
  /** Number of monitored chapters */
  monitoredCount: number;
  /** Total number of chapters */
  totalChapters: number;
  /** Whether details section is expanded */
  isDetailsExpanded: boolean;
  /** Handler to toggle details expansion */
  setIsDetailsExpanded: (expanded: boolean) => void;
  /** Mutation for toggling series monitoring */
  toggleSeriesMonitoringMutation: { isPending: boolean };
  /** Mutation for series quick download */
  seriesQuickDownloadMutation: { isPending: boolean };
  /** Mutation for resetting every failed chapter on the manga (manga-wide) */
  resetAllFailedDownloadsMutation: { isPending: boolean };
  /** Handler for toggling manga bookmark */
  handleToggleMangaBookmark: () => void;
  /** Handler for series quick download */
  handleSeriesQuickDownload: () => void;
  /** Handler for the manga-wide "Reset all failed" header action */
  handleResetAllFailed: () => void;
  /** True when at least one chapter has downloadStatus === 'ERROR' — gates
   *  the visibility of the header "Reset all failed" action icon. */
  hasAnyFailedChapter: boolean;
  /** Function to check if provider is bound */
  isProviderBound: (provider: string) => boolean;
}
