/**
 * Manga Detail Modals Component
 *
 * Aggregates all modal components used in the manga detail page.
 * This component manages the rendering of all modals to reduce clutter
 * in the main page component.
 *
 * @module components/manga/manga-detail-modals
 */

import React from 'react';

import { AniListBindingModal } from './AniListBindingModal';
import { ChapterModal } from './ChapterModal';
import { MetadataModals } from './MetadataModals';
import { ProviderBindingModals } from './ProviderBindingModals';

import type { MangaDetailModalsProps } from './types';

/**
 * Renders all modals used in the manga detail page
 *
 * @param props - Component props
 * @returns Modal components
 */
export function MangaDetailModals(props: MangaDetailModalsProps): React.ReactElement {
  const {
    manga,
    mangaId,
    isAniListModalOpen,
    setIsAniListModalOpen,
    isComicVineModalOpen,
    setIsComicVineModalOpen,
    isFandomModalOpen,
    setIsFandomModalOpen,
    isWikipediaModalOpen,
    setIsWikipediaModalOpen,
    isMangaDexModalOpen,
    setIsMangaDexModalOpen,
    isProviderMetadataModalOpen,
    setIsProviderMetadataModalOpen,
    isCoverSelectorOpen,
    setIsCoverSelectorOpen,
    isMangaUpdatesModalOpen,
    setIsMangaUpdatesModalOpen,
    isMalModalOpen,
    setIsMalModalOpen,
    isKitsuModalOpen,
    setIsKitsuModalOpen,
    chapterModalOpened,
    setChapterModalOpened,
    selectedChapter,
    setSelectedChapter,
    initialModalTab,
    refetch
  } = props;

  // Only render modals if mangaId is valid
  if (mangaId === undefined) {
    return <></>;
  }

  return (
    <>
      <AniListBindingModal
        manga={manga}
        mangaId={mangaId}
        isAniListModalOpen={isAniListModalOpen}
        setIsAniListModalOpen={setIsAniListModalOpen}
        refetch={refetch}
      />

      <ProviderBindingModals
        manga={manga}
        mangaId={mangaId}
        refetch={refetch}
        isComicVineModalOpen={isComicVineModalOpen}
        setIsComicVineModalOpen={setIsComicVineModalOpen}
        isFandomModalOpen={isFandomModalOpen}
        setIsFandomModalOpen={setIsFandomModalOpen}
        isWikipediaModalOpen={isWikipediaModalOpen}
        setIsWikipediaModalOpen={setIsWikipediaModalOpen}
        isMangaDexModalOpen={isMangaDexModalOpen}
        setIsMangaDexModalOpen={setIsMangaDexModalOpen}
        isMangaUpdatesModalOpen={isMangaUpdatesModalOpen}
        setIsMangaUpdatesModalOpen={setIsMangaUpdatesModalOpen}
        isMalModalOpen={isMalModalOpen}
        setIsMalModalOpen={setIsMalModalOpen}
        isKitsuModalOpen={isKitsuModalOpen}
        setIsKitsuModalOpen={setIsKitsuModalOpen}
      />

      <MetadataModals
        manga={manga}
        mangaId={mangaId}
        refetch={refetch}
        isProviderMetadataModalOpen={isProviderMetadataModalOpen}
        setIsProviderMetadataModalOpen={setIsProviderMetadataModalOpen}
        isCoverSelectorOpen={isCoverSelectorOpen}
        setIsCoverSelectorOpen={setIsCoverSelectorOpen}
      />

      <ChapterModal
        manga={manga}
        mangaId={mangaId}
        chapterModalOpened={chapterModalOpened}
        setChapterModalOpened={setChapterModalOpened}
        selectedChapter={selectedChapter}
        setSelectedChapter={setSelectedChapter}
        initialModalTab={initialModalTab}
      />
    </>
  );
}
