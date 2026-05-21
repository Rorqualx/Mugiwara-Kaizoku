/**
 * useReaderPreload Hook
 *
 * Manages page preloading and reading speed tracking.
 */

import { useRef, useEffect} from 'react';

import type { ReaderSettings } from '@/types/reader/reader-types';
import { PreloaderService } from '@/utils/reader/PreloaderService';

import type { UseReaderPreloadReturn } from './types';

interface UseReaderPreloadOptions {
  pages: string[];
  currentPage: number;
  settings: ReaderSettings;
  getPageUrl: (pageNumber: number) => string | null;
}

export function useReaderPreload({
  pages,
  currentPage,
  settings,
  getPageUrl
}: UseReaderPreloadOptions): UseReaderPreloadReturn {
  const preloaderRef = useRef<PreloaderService>(new PreloaderService());

  // Track page views for reading speed
  useEffect(() => {
    preloaderRef.current.recordPageView(currentPage);
  }, [currentPage]);

  // Preload pages when current page changes
  useEffect(() => {
    if (pages.length > 0) {
      void preloaderRef.current.preloadPages(
        pages,
        currentPage,
        'both',
        settings.preloadPages,
        getPageUrl
      );
    }
  }, [currentPage, pages, settings.preloadPages, getPageUrl]);

  // Cleanup preloader on unmount
  useEffect(() => {
    const preloader = preloaderRef.current;
    return () => {
      preloader.cleanup();
    };
  }, []);

  return {
    preloadStats: preloaderRef.current.getStats()
  };
}
