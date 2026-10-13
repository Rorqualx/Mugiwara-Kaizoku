/**
 * Modal open/close state for the manga detail page.
 *
 * @module hooks/manga/useMangaDetailModals
 */

import React from 'react';

import type { Chapter } from '@prisma/client';

/**
 * Return type for useMangaDetailModals hook
 */
interface MangaDetailModalsReturn {
  isAniListModalOpen: boolean;
  setIsAniListModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isComicVineModalOpen: boolean;
  setIsComicVineModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isFandomModalOpen: boolean;
  setIsFandomModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isWikipediaModalOpen: boolean;
  setIsWikipediaModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isMangaDexModalOpen: boolean;
  setIsMangaDexModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isMangaUpdatesModalOpen: boolean;
  setIsMangaUpdatesModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isMalModalOpen: boolean;
  setIsMalModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isKitsuModalOpen: boolean;
  setIsKitsuModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isProviderMetadataModalOpen: boolean;
  setIsProviderMetadataModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isCoverSelectorOpen: boolean;
  setIsCoverSelectorOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isDetailsExpanded: boolean;
  setIsDetailsExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  isProvidersExpanded: boolean;
  setIsProvidersExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  chapterModalOpened: boolean;
  setChapterModalOpened: React.Dispatch<React.SetStateAction<boolean>>;
  selectedChapter: Chapter | null;
  setSelectedChapter: React.Dispatch<React.SetStateAction<Chapter | null>>;
  initialModalTab: 'details' | 'search';
  setInitialModalTab: React.Dispatch<React.SetStateAction<'details' | 'search'>>;
}

/**
 * Hook for managing all modal and expansion state in the manga detail page
 */
export function useMangaDetailModals(): MangaDetailModalsReturn {
  const [isAniListModalOpen, setIsAniListModalOpen] = React.useState(false);
  const [isComicVineModalOpen, setIsComicVineModalOpen] = React.useState(false);
  const [isFandomModalOpen, setIsFandomModalOpen] = React.useState(false);
  const [isWikipediaModalOpen, setIsWikipediaModalOpen] = React.useState(false);
  const [isMangaDexModalOpen, setIsMangaDexModalOpen] = React.useState(false);
  const [isMangaUpdatesModalOpen, setIsMangaUpdatesModalOpen] = React.useState(false);
  const [isMalModalOpen, setIsMalModalOpen] = React.useState(false);
  const [isKitsuModalOpen, setIsKitsuModalOpen] = React.useState(false);
  const [isProviderMetadataModalOpen, setIsProviderMetadataModalOpen] = React.useState(false);
  const [isCoverSelectorOpen, setIsCoverSelectorOpen] = React.useState(false);
  const [isDetailsExpanded, setIsDetailsExpanded] = React.useState(false);
  const [isProvidersExpanded, setIsProvidersExpanded] = React.useState(false);
  const [chapterModalOpened, setChapterModalOpened] = React.useState(false);
  const [selectedChapter, setSelectedChapter] = React.useState<Chapter | null>(null);
  const [initialModalTab, setInitialModalTab] = React.useState<'details' | 'search'>('details');

  return {
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
    isMangaUpdatesModalOpen,
    setIsMangaUpdatesModalOpen,
    isMalModalOpen,
    setIsMalModalOpen,
    isKitsuModalOpen,
    setIsKitsuModalOpen,
    isProviderMetadataModalOpen,
    setIsProviderMetadataModalOpen,
    isCoverSelectorOpen,
    setIsCoverSelectorOpen,
    isDetailsExpanded,
    setIsDetailsExpanded,
    isProvidersExpanded,
    setIsProvidersExpanded,
    chapterModalOpened,
    setChapterModalOpened,
    selectedChapter,
    setSelectedChapter,
    initialModalTab,
    setInitialModalTab
  };
}
