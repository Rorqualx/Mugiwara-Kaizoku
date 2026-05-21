/**
 * VolumeChaptersTable Sub-component Types
 *
 * Internal prop types for extracted sub-components.
 *
 * @module components/volumeChapters/VolumeChaptersTable/types
 */

import type { VolumeData } from '@/components/volumeChapters/types';

import type { Chapter } from '@prisma/client';

/**
 * Props for VolumeHeader component
 */
export interface VolumeHeaderProps {
  volumeNumber: number;
  volumeTitle?: string | null | undefined;
  chapterRange?: string | null | undefined;
  chapters: Chapter[];
  volumePageCount: number;
  volumeSize: number;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  onOpenVolumeModal: () => void;
  headerActionsProps: VolumeHeaderActionsWrapperProps;
}

/**
 * Props passed to VolumeHeaderActions wrapper
 */
export interface VolumeHeaderActionsWrapperProps {
  volumeNumber: number;
  mangaId: number | undefined;
  mangaTitle?: string | undefined;
  chapters: Chapter[];
  allVolumeMonitored: boolean;
  someVolumeMonitored: boolean;
  noneVolumeMonitored: boolean;
  totalVolumeChapters: number;
  volumeMonitoredCount: number;
  isTogglingVolume: boolean;
  isDownloadingVolume: boolean;
  isDeletingAll?: boolean | undefined;
  onToggleMonitoring: () => void;
  onQuickDownload: () => void;
  onOpenReassignModal: () => void;
  onDeleteAllUnassigned?: (() => void) | undefined;
}

/**
 * Props for VolumeContent component
 */
export interface VolumeContentProps {
  isExpanded: boolean;
  records: Chapter[];
  columns: unknown[];
  chaptersCount: number;
}

/**
 * Props for VolumeModals component
 */
export interface VolumeModalsProps {
  volumeModalOpened: boolean;
  onCloseVolumeModal: () => void;
  enrichedVolumeModalData: unknown;
  mangaId: number | undefined;
  chapters: Chapter[];
  volumeData?: VolumeData | null | undefined;
  onChapterClick?: ((chapter: Chapter, enrichedChapter: Chapter) => void) | undefined;
  reassignModalOpened: boolean;
  onCloseReassignModal: () => void;
  volumeNumber: number;
  onReassignComplete: () => void;
}
