/**
 * Type definitions for MangaDetailBanner components
 *
 * @module components/manga/manga-detail-banner/types
 */


import type { MetadataConflict } from '@/types/metadata-types';
import type { MangaWithRelations } from '@/types/search.types';
import type { AsyncResult } from '@/utils/async-result';

import type { MangaPublicationStatus as MangaStatus } from '@prisma/client';

/**
 * Props for MangaDetailBanner component
 */
export interface MangaDetailBannerProps {
  /** Manga data with all relations */
  manga: MangaWithRelations;
  /** Manga ID as number for API calls */
  mangaIdNum: number;
  /** Cover image URL */
  coverUrl: string;
  /** Formatted status value */
  formattedStatus: MangaStatus;
  /** Total file size in bytes */
  totalSize: number;
  /** Conflicts state with AsyncResult pattern */
  conflictsState: AsyncResult<MetadataConflict[], Error>;
  /** Number of conflicts detected */
  conflictsCount: number;
  /** Whether description is expanded */
  isDescriptionExpanded: boolean;
  /** Callback to toggle description expansion */
  setIsDescriptionExpanded: (value: boolean) => void;
  /** Whether synonyms/alternative titles are expanded */
  isSynonymsExpanded: boolean;
  /** Callback to toggle synonyms expansion */
  setIsSynonymsExpanded: (value: boolean) => void;
  /** Callback to open conflict resolution modal */
  setIsConflictModalOpen: (value: boolean) => void;
  /** Callback when conflicts are resolved */
  handleConflictsResolved: () => void;
}

/**
 * Props for MetadataBadges component
 */
export interface MetadataBadgesProps {
  /** Manga data with all relations */
  manga: MangaWithRelations;
  /** Manga ID as number for API calls */
  mangaIdNum: number;
  /** Formatted status value */
  formattedStatus: MangaStatus;
  /** Conflicts state with AsyncResult pattern */
  conflictsState: AsyncResult<MetadataConflict[], Error>;
  /** Number of conflicts detected */
  conflictsCount: number;
  /** Callback to open conflict resolution modal */
  setIsConflictModalOpen: (value: boolean) => void;
  /** Callback when conflicts are resolved */
  handleConflictsResolved: () => void;
}

/**
 * Props for CollapsibleSection component
 */
export interface CollapsibleSectionProps {
  /** Manga data with all relations */
  manga: MangaWithRelations;
  /** Whether section is expanded */
  isExpanded: boolean;
  /** Callback to toggle expansion */
  setIsExpanded: (value: boolean) => void;
}

/**
 * Props for AdditionalMetadata component
 */
export interface AdditionalMetadataProps {
  /** Manga data with all relations */
  manga: MangaWithRelations;
  /** Total file size in bytes */
  totalSize: number;
}
