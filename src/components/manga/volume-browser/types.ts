/**
 * Type definitions for VolumeBrowser component
 *
 * @module volume-browser/types
 */

import type { EnhancedVolumeData, EnhancedChapterReference } from '@/types/search-types/metadata.types';

/**
 * Provider-specific volume metadata aggregation
 */
export interface ProviderVolumeMetadata {
  volumeData?: EnhancedVolumeData[];
  totalVolumes?: number;
  totalChapters?: number;
  themes?: string[];
  genres?: string[];
  creators?: {
    authors?: string[];
    artists?: string[];
  };
  storyArcs?: string[];
  lastFetched?: string;
}

/**
 * Main VolumeBrowser component props
 */
export interface VolumeBrowserProps {
  /**
   * Enhanced volume data from provider metadata
   */
  providerData?: ProviderVolumeMetadata;

  /**
   * Provider name for attribution
   */
  provider?: 'comicvine' | 'fandom' | 'anilist' | 'wikipedia';

  /**
   * Loading state
   */
  isLoading?: boolean;

  /**
   * Maximum volumes to display initially
   */
  initialDisplayCount?: number;

  /**
   * Callback when a chapter is clicked
   */
  onChapterClick?: (chapter: EnhancedChapterReference) => void;

  /**
   * Callback when a volume is clicked
   */
  onVolumeClick?: (volume: EnhancedVolumeData) => void;
}

/**
 * Header component props
 */
export interface VolumeBrowserHeaderProps {
  totalVolumes: number;
  volumeCount: number;
  provider?: 'comicvine' | 'fandom' | 'anilist' | 'wikipedia' | undefined;
  lastFetched?: string | undefined;
}

/**
 * Metadata display component props
 */
export interface VolumeBrowserMetadataProps {
  creators?: {
    authors?: string[];
    artists?: string[];
  } | undefined;
  themes?: string[] | undefined;
  storyArcs?: string[] | undefined;
}

/**
 * Volume card component props
 */
export interface VolumeCardProps {
  volume: EnhancedVolumeData;
  isExpanded: boolean;
  onToggle: () => void;
  onChapterClick: ((chapter: EnhancedChapterReference) => void) | undefined;
}

/**
 * Chapter row component props (renamed to avoid collision with ChapterRow.tsx)
 */
export interface VolumeChapterRowProps {
  chapter: EnhancedChapterReference;
  onClick?: () => void;
}
