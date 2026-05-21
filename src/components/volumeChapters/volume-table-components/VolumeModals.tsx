/**
 * VolumeModals Component
 *
 * Coordinates VolumeDetailModal and ChapterReassignModal.
 *
 * @module components/volumeChapters/volume-table-components/VolumeModals
 */

import { memo } from 'react';

import { VolumeDetailModal } from '@/components/manga/VolumeDetailModal';
import { ChapterReassignModal } from '@/components/volumeChapters/chapter-reassign-modal';
import { enrichChapter } from '@/components/volumeChapters/utils';

import type { VolumeModalsProps } from './types';
import type { Chapter } from '@prisma/client';

/**
 * Modal coordination for volume detail and chapter reassignment
 */
export const VolumeModals = memo(({
  volumeModalOpened,
  onCloseVolumeModal,
  enrichedVolumeModalData,
  mangaId,
  chapters,
  volumeData,
  onChapterClick,
  reassignModalOpened,
  onCloseReassignModal,
  volumeNumber,
  onReassignComplete
}: VolumeModalsProps): JSX.Element => (
  <>
    {/* Volume Detail Modal */}
    <VolumeDetailModal
      opened={volumeModalOpened}
      onClose={onCloseVolumeModal}
      volume={enrichedVolumeModalData as Parameters<typeof VolumeDetailModal>[0]['volume']}
      mangaId={mangaId}
      onChapterClick={(chapterIndex: number) => {
        const chapter = chapters.find((ch: Chapter) => ch.index === chapterIndex);
        if (chapter && onChapterClick) {
          const enrichedChapterData = enrichChapter(chapter, volumeData) as Chapter;
          onChapterClick(chapter, enrichedChapterData);
          onCloseVolumeModal();
        }
      }}
    />

    {/* Chapter Reassign Modal (only for unassigned chapters) */}
    {volumeNumber === -1 && mangaId && (
      <ChapterReassignModal
        opened={reassignModalOpened}
        onClose={onCloseReassignModal}
        mangaId={mangaId}
        unassignedChapters={chapters}
        onReassignComplete={onReassignComplete}
      />
    )}
  </>
));

VolumeModals.displayName = 'VolumeModals';
