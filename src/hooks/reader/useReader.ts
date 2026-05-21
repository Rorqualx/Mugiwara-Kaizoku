/**
 * useReader Hook - Main Reader Orchestrator
 *
 * Composes sub-hooks to provide unified reader functionality.
 */

import { useReaderStore } from '@/store/readerSlice';

import { useReaderArchive } from './useReaderArchive';
import { useReaderChapterNavigation } from './useReaderChapterNavigation';
import { useReaderPageNavigation } from './useReaderPageNavigation';
import { useReaderPreload } from './useReaderPreload';
import { useReaderProgress } from './useReaderProgress';

import type { UseReaderReturn } from './types';

export function useReader(): UseReaderReturn {
  const { currentFile, currentPage, settings, setPage, updateSettings } = useReaderStore();

  // Archive management (loading, extraction, page URLs)
  const archive = useReaderArchive();

  // Progress tracking
  const progress = useReaderProgress({
    currentFile,
    currentPage,
    currentChapterId: archive.currentChapterId
  });

  // Page navigation
  const pageNav = useReaderPageNavigation({
    currentFile,
    currentPage,
    settings,
    pages: archive.pages,
    setPage,
    saveProgress: progress.saveProgress,
    getPageUrl: archive.getPageUrl
  });

  // Chapter navigation
  const chapterNav = useReaderChapterNavigation({
    currentMangaId: archive.currentMangaId,
    currentChapterId: archive.currentChapterId,
    loadChapter: archive.loadChapter
  });

  // Page preloading
  const preload = useReaderPreload({
    pages: archive.pages,
    currentPage,
    settings,
    getPageUrl: archive.getPageUrl
  });

  return {
    // State
    file: currentFile,
    currentPage,
    totalPages: currentFile?.totalPages ?? 0,
    isLoading: archive.isLoading,
    error: archive.error,
    settings,
    pages: archive.pages,
    currentDoublePageUrls: pageNav.currentDoublePageUrls,
    preloadStats: preload.preloadStats,

    // Chapter Navigation
    chapterNavigation: chapterNav.chapterNavigation,
    isLoadingNavigation: chapterNav.isLoadingNavigation,

    // Functions
    loadChapter: archive.loadChapter,
    nextPage: pageNav.nextPage,
    prevPage: pageNav.prevPage,
    goToPage: pageNav.goToPage,
    updateSettings,
    getPageUrl: archive.getPageUrl,
    getDoublePageUrls: pageNav.getDoublePageUrls,
    nextChapter: chapterNav.nextChapter,
    prevChapter: chapterNav.prevChapter,
    jumpToChapter: chapterNav.jumpToChapter,
    reloadCurrentChapter: archive.reloadCurrentChapter
  };
}
