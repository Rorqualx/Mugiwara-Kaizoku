/**
 * ConfirmationModals Component
 *
 * Modal dialogs for the confirmation step
 */
import React from 'react';

import { BannerModal, ChapterPreviewModal } from './MediaModals';

import type { FieldSelections } from '../hooks/useFieldSelections';

interface ConfirmationModalsProps {
  bannerModalOpened: boolean;
  chapterModalOpen: boolean;
  fieldSelections: FieldSelections;
  selectedChapter?: {
    number: number;
    title: string;
    coverImage?: string;
    releaseDate?: string;
    pageCount?: number;
    scanlator?: string;
    url?: string;
  };
  onBannerModalClose: () => void;
  onChapterModalClose: () => void;
}

export function ConfirmationModals({
  bannerModalOpened,
  chapterModalOpen,
  fieldSelections,
  selectedChapter,
  onBannerModalClose,
  onChapterModalClose
}: ConfirmationModalsProps): React.ReactElement {
  return (
    <>
      <BannerModal
        opened={bannerModalOpened}
        onClose={onBannerModalClose}
        {...(typeof fieldSelections['bannerImage']?.value === 'string' && {
          bannerImage: fieldSelections['bannerImage'].value
        })}
        {...(typeof fieldSelections['title']?.value === 'string' && {
          title: fieldSelections['title'].value
        })}
      />

      <ChapterPreviewModal
        opened={chapterModalOpen}
        onClose={onChapterModalClose}
        {...(selectedChapter && { chapter: selectedChapter })}
      />
    </>
  );
}
