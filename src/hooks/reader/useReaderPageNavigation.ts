/**
 * useReaderPageNavigation Hook
 *
 * Manages page navigation and double-page URL calculations.
 */

import { useCallback, useMemo } from 'react';

import type { MangaFile, DoublePageUrls, ReaderSettings } from '@/types/reader/reader-types';

import type { UseReaderPageNavigationReturn } from './types';

interface UseReaderPageNavigationOptions {
  currentFile: MangaFile | null;
  currentPage: number;
  settings: ReaderSettings;
  pages: string[];
  setPage: (page: number) => void;
  saveProgress: (page: number) => void;
  getPageUrl: (pageNumber: number) => string | null;
}

export function useReaderPageNavigation({
  currentFile,
  currentPage,
  settings,
  pages,
  setPage,
  saveProgress,
  getPageUrl
}: UseReaderPageNavigationOptions): UseReaderPageNavigationReturn {
  // Calculate double page URLs
  const getDoublePageUrls = useCallback((pageNumber: number): DoublePageUrls => {
    if (settings.readingMode !== 'double') {
      return { left: null, right: null };
    }

    const isRTL = settings.readingDirection === 'rtl';
    const offset = settings.doublePageOffset ? 1 : 0;

    let leftPage: number, rightPage: number;

    if (isRTL) {
      rightPage = pageNumber + offset;
      leftPage = rightPage + 1;
    } else {
      leftPage = pageNumber + offset;
      rightPage = leftPage + 1;
    }

    const leftUrl = leftPage <= pages.length ? getPageUrl(leftPage) : null;
    const rightUrl = rightPage <= pages.length ? getPageUrl(rightPage) : null;

    return { left: leftUrl, right: rightUrl };
  }, [settings, pages.length, getPageUrl]);

  // Get current double page URLs
  const currentDoublePageUrls = useMemo(() => {
    return getDoublePageUrls(currentPage);
  }, [currentPage, getDoublePageUrls]);

  // Navigate to next page
  const nextPage = useCallback(() => {
    if (!currentFile) return;

    const increment = settings.readingMode === 'double' ? 2 : 1;
    const newPage = Math.min(currentPage + increment, currentFile.totalPages);

    if (newPage > currentPage && newPage <= currentFile.totalPages) {
      setPage(newPage);
      saveProgress(newPage);
    }
  }, [currentPage, currentFile, settings.readingMode, setPage, saveProgress]);

  // Navigate to previous page
  const prevPage = useCallback(() => {
    const decrement = settings.readingMode === 'double' ? 2 : 1;
    const newPage = Math.max(currentPage - decrement, 1);

    if (newPage < currentPage) {
      setPage(newPage);
      saveProgress(newPage);
    }
  }, [currentPage, settings.readingMode, setPage, saveProgress]);

  // Go to specific page
  const goToPage = useCallback((page: number) => {
    if (currentFile && page >= 1 && page <= currentFile.totalPages) {
      setPage(page);
      saveProgress(page);
    }
  }, [currentFile, setPage, saveProgress]);

  return {
    getDoublePageUrls,
    currentDoublePageUrls,
    nextPage,
    prevPage,
    goToPage
  };
}
