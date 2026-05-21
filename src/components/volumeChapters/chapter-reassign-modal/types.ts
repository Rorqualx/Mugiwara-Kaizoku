/**
 * Chapter Reassign Modal Types
 *
 * @module components/volumeChapters/chapter-reassign-modal/types
 */

import type { Chapter } from '@prisma/client';

export interface ChapterReassignModalProps {
  opened: boolean;
  onClose: () => void;
  mangaId: number;
  unassignedChapters: Chapter[];
  onReassignComplete: () => void;
}

export interface VolumeOption {
  value: string;
  label: string;
}

export interface ChapterOption {
  value: string;
  label: string;
}

/** File type for assertion - is this file a chapter or a volume? */
export type FileType = 'chapter' | 'volume';

export interface FileTypeOption {
  value: FileType;
  label: string;
}

export interface ChapterAssignment {
  chapterId: number;
  volumeNumber: number | null;
  /** If user asserts file is a volume, this will be 'volume' */
  fileType?: FileType;
  /** If fileType is 'volume', this is the volume number to create */
  assertedVolumeNumber?: number;
  /** If fileType is 'chapter', this is the target chapter ID to link to */
  targetChapterId?: number;
}

export interface AutoAssignTabProps {
  mangaId: number;
  onApply: () => void;
  isApplying: boolean;
}

export interface ManualAssignTabProps {
  mangaId: number;
  unassignedChapters: Chapter[];
  onSave: (assignments: ChapterAssignment[]) => void;
  isSaving: boolean;
}
