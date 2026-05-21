/**
 * Chapter Detail Modal Wrapper
 *
 * Handles chapter detail modal
 *
 * @module components/manga/manga-detail-modals/ChapterModal
 */

import React from 'react';

import { ChapterDetailModal } from '@/components/manga/ChapterDetailModal';

import type { ChapterModalProps } from './types';

/**
 * Renders chapter detail modal
 *
 * @param props - Component props
 * @returns Chapter detail modal component
 */
export function ChapterModal(props: ChapterModalProps): React.ReactElement {
  const {
    manga,
    mangaId,
    chapterModalOpened,
    setChapterModalOpened,
    selectedChapter,
    setSelectedChapter,
    initialModalTab
  } = props;

  const handleClose = (): void => {
    setChapterModalOpened(false);
    setSelectedChapter(null);
  };

  return (
    <ChapterDetailModal
      opened={chapterModalOpened}
      onClose={handleClose}
      chapter={selectedChapter}
      mangaTitle={(manga?.title ?? '') as string}
      mangaId={mangaId}
      initialTab={initialModalTab}
    />
  );
}
