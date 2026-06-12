/**
 * Chapter Reassign Modal
 *
 * Modal for reassigning unassigned chapters to volumes.
 * Supports both chapter assignment and file type conversion.
 *
 * @module components/volumeChapters/chapter-reassign-modal
 */

import { memo, useCallback, type JSX } from 'react';

import { Modal, Alert } from '@mantine/core';
import { IconCheck } from '@tabler/icons-react';

import { notify } from '@/utils/notify';
import { trpc } from '@/utils/trpc-client';

import { ManualAssignTab } from './ManualAssignTab';

import type { ChapterReassignModalProps, ChapterAssignment } from './types';

// ============================================================================
// Helper Functions
// ============================================================================

/** Separate assignments into chapter links and volume conversions */
function categorizeAssignments(assignments: ChapterAssignment[]): {
  chapterLinks: Array<{ sourceChapterId: number; targetChapterId: number }>;
  volumeConversions: Array<{ chapterId: number; volumeNumber: number }>;
} {
  const chapterLinks: Array<{ sourceChapterId: number; targetChapterId: number }> = [];
  const volumeConversions: Array<{ chapterId: number; volumeNumber: number }> = [];

  for (const a of assignments) {
    if (a.fileType === 'volume' && a.assertedVolumeNumber !== undefined) {
      volumeConversions.push({ chapterId: a.chapterId, volumeNumber: a.assertedVolumeNumber });
    } else if (a.fileType === 'chapter' && a.targetChapterId !== undefined) {
      chapterLinks.push({ sourceChapterId: a.chapterId, targetChapterId: a.targetChapterId });
    }
  }

  return { chapterLinks, volumeConversions };
}

// ============================================================================
// Main Component
// ============================================================================

function ChapterReassignModalComponent(props: ChapterReassignModalProps): JSX.Element {
  const { opened, onClose, mangaId, unassignedChapters, onReassignComplete } = props;

  const utils = trpc.useUtils();

  const linkMutation = trpc.chapter.linkFileToChapter.useMutation({
    onError: (error) => {
      notify({ severity: 'ERROR', title: 'Link Failed', message: error.message });
    }
  });

  const convertMutation = trpc.chapter.convertChapterToVolume.useMutation({
    onError: (error) => {
      notify({ severity: 'ERROR', title: 'Conversion Failed', message: error.message });
    }
  });

  const handleManualSave = useCallback(async (assignments: ChapterAssignment[]) => {
    const { chapterLinks, volumeConversions } = categorizeAssignments(assignments);
    const promises: Promise<unknown>[] = [];
    let linkCount = 0;
    let volumeCount = 0;

    // Process chapter links (linking files to existing chapters)
    for (const { sourceChapterId, targetChapterId } of chapterLinks) {
      promises.push(
        linkMutation.mutateAsync({ sourceChapterId, targetChapterId, mangaId }).then(() => {
          linkCount += 1;
        })
      );
    }

    // Process volume conversions
    for (const { chapterId, volumeNumber } of volumeConversions) {
      promises.push(
        convertMutation.mutateAsync({ chapterId, volumeNumber, mangaId }).then(() => {
          volumeCount += 1;
        })
      );
    }

    try {
      await Promise.all(promises);
    } catch {
      // Per-mutation onError handlers already notified the user; skip the
      // success summary when any assignment failed.
      return;
    }

    const totalUpdated = linkCount + volumeCount;
    if (totalUpdated > 0) {
      const parts: string[] = [];
      if (linkCount > 0) parts.push(`${linkCount} file${linkCount !== 1 ? 's' : ''} linked`);
      if (volumeCount > 0) parts.push(`${volumeCount} volume${volumeCount !== 1 ? 's' : ''} converted`);
      notify({ severity: 'SUCCESS', title: 'Save Complete', message: parts.join(' and ') });
      void utils.chapter.previewAutoAssign.invalidate({ mangaId });
      void utils.chapter.getByMangaId.invalidate({ mangaId });
      onReassignComplete();
    }
  }, [linkMutation, convertMutation, mangaId, utils, onReassignComplete]);

  const isSaving = linkMutation.isPending || convertMutation.isPending;

  if (unassignedChapters.length === 0) {
    return (
      <Modal opened={opened} onClose={onClose} title="Reassign Files" size="lg">
        <Alert icon={<IconCheck size={16} />} color="green">
          No unassigned files to reassign.
        </Alert>
      </Modal>
    );
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Reassign Files to Chapters & Volumes" size="xl">
      <ManualAssignTab
        mangaId={mangaId}
        unassignedChapters={unassignedChapters}
        onSave={(assignments) => void handleManualSave(assignments)}
        isSaving={isSaving}
      />
    </Modal>
  );
}

export const ChapterReassignModal = memo(ChapterReassignModalComponent);
ChapterReassignModal.displayName = 'ChapterReassignModal';

// Re-export types
export type { ChapterReassignModalProps } from './types';
