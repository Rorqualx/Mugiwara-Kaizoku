/**
 * Type definitions for MangaDetailModals component
 *
 * @module components/manga/manga-detail-modals/types
 */

import type { MangaWithRelations } from '@/types/search.types';

import type { Chapter as ChapterEntity } from '@prisma/client';

/**
 * Props for MangaDetailModals component
 */
export interface MangaDetailModalsProps {
  manga: MangaWithRelations | null;
  mangaId: number | undefined;

  // AniList Modal
  isAniListModalOpen: boolean;
  setIsAniListModalOpen: (open: boolean) => void;

  // ComicVine Modal
  isComicVineModalOpen: boolean;
  setIsComicVineModalOpen: (open: boolean) => void;

  // Fandom Modal
  isFandomModalOpen: boolean;
  setIsFandomModalOpen: (open: boolean) => void;

  // Wikipedia Modal
  isWikipediaModalOpen: boolean;
  setIsWikipediaModalOpen: (open: boolean) => void;

  // MangaDex Modal
  isMangaDexModalOpen: boolean;
  setIsMangaDexModalOpen: (open: boolean) => void;

  // Provider Metadata Modal
  isProviderMetadataModalOpen: boolean;
  setIsProviderMetadataModalOpen: (open: boolean) => void;

  // Cover Selector Modal
  isCoverSelectorOpen: boolean;
  setIsCoverSelectorOpen: (open: boolean) => void;

  // MangaUpdates Binding Modal
  isMangaUpdatesModalOpen: boolean;
  setIsMangaUpdatesModalOpen: (open: boolean) => void;

  // MyAnimeList Binding Modal
  isMalModalOpen: boolean;
  setIsMalModalOpen: (open: boolean) => void;

  // Kitsu Binding Modal
  isKitsuModalOpen: boolean;
  setIsKitsuModalOpen: (open: boolean) => void;

  // Chapter Detail Modal
  chapterModalOpened: boolean;
  setChapterModalOpened: (open: boolean) => void;
  selectedChapter: ChapterEntity | null;
  setSelectedChapter: (chapter: ChapterEntity | null) => void;
  initialModalTab: 'details' | 'search';

  // Refetch function
  refetch: () => Promise<void>;
}

/**
 * Props for ProviderBindingModals component
 */
export interface ProviderBindingModalsProps {
  manga: MangaWithRelations | null;
  mangaId: number;
  refetch: () => Promise<void>;

  // ComicVine Modal
  isComicVineModalOpen: boolean;
  setIsComicVineModalOpen: (open: boolean) => void;

  // Fandom Modal
  isFandomModalOpen: boolean;
  setIsFandomModalOpen: (open: boolean) => void;

  // Wikipedia Modal
  isWikipediaModalOpen: boolean;
  setIsWikipediaModalOpen: (open: boolean) => void;

  // MangaDex Modal
  isMangaDexModalOpen: boolean;
  setIsMangaDexModalOpen: (open: boolean) => void;

  // MangaUpdates Modal
  isMangaUpdatesModalOpen: boolean;
  setIsMangaUpdatesModalOpen: (open: boolean) => void;

  // MyAnimeList Modal
  isMalModalOpen: boolean;
  setIsMalModalOpen: (open: boolean) => void;

  // Kitsu Modal
  isKitsuModalOpen: boolean;
  setIsKitsuModalOpen: (open: boolean) => void;
}

/**
 * Props for AniListBindingModal component
 */
export interface AniListBindingModalProps {
  manga: MangaWithRelations | null;
  mangaId: number;
  isAniListModalOpen: boolean;
  setIsAniListModalOpen: (open: boolean) => void;
  refetch: () => Promise<void>;
}

/**
 * Props for MetadataModals component
 */
export interface MetadataModalsProps {
  manga: MangaWithRelations | null;
  mangaId: number;
  refetch: () => Promise<void>;

  // Provider Metadata Modal
  isProviderMetadataModalOpen: boolean;
  setIsProviderMetadataModalOpen: (open: boolean) => void;

  // Cover Selector Modal
  isCoverSelectorOpen: boolean;
  setIsCoverSelectorOpen: (open: boolean) => void;
}

/**
 * Props for ChapterModal component
 */
export interface ChapterModalProps {
  manga: MangaWithRelations | null;
  mangaId: number;
  chapterModalOpened: boolean;
  setChapterModalOpened: (open: boolean) => void;
  selectedChapter: ChapterEntity | null;
  setSelectedChapter: (chapter: ChapterEntity | null) => void;
  initialModalTab: 'details' | 'search';
}
