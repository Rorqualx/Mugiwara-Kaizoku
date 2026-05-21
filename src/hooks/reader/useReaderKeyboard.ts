/**
 * useReaderKeyboard Hook
 *
 * Handles keyboard navigation for the reader component.
 * Supports arrow keys, space, f (fullscreen), b (bookmark), s (settings), Home/End, n/p (next/prev chapter).
 */

import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react';

import type { ReaderSettings } from '@/types/reader/reader-types';

interface UseReaderKeyboardProps {
  enabled: boolean;
  settingsOpen: boolean;
  settings: ReaderSettings;
  currentPage: number;
  totalPages: number;
  nextPage: () => void;
  prevPage: () => void;
  goToPage: (page: number) => void;
  toggleFullscreen: () => Promise<void>;
  toggleBookmark: () => void;
  setSettingsOpen: Dispatch<SetStateAction<boolean>>;
  nextChapter: () => Promise<void>;
  prevChapter: () => Promise<void>;
}

export function useReaderKeyboard({
  enabled,
  settingsOpen,
  settings,
  currentPage,
  totalPages,
  nextPage,
  prevPage,
  goToPage,
  toggleFullscreen,
  toggleBookmark,
  setSettingsOpen,
  nextChapter,
  prevChapter,
}: UseReaderKeyboardProps): void {
  // Store all callbacks in a ref to avoid re-attaching the listener on every change
  const propsRef = useRef({
    settingsOpen, settings, currentPage, totalPages,
    nextPage, prevPage, goToPage, toggleFullscreen,
    toggleBookmark, setSettingsOpen, nextChapter, prevChapter,
  });
  propsRef.current = {
    settingsOpen, settings, currentPage, totalPages,
    nextPage, prevPage, goToPage, toggleFullscreen,
    toggleBookmark, setSettingsOpen, nextChapter, prevChapter,
  };

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent): void => {
      const p = propsRef.current;
      // Don't handle if settings modal is open
      if (p.settingsOpen) return;

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          if (p.settings.readingDirection === 'rtl') {
            p.nextPage();
          } else {
            p.prevPage();
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (p.settings.readingDirection === 'rtl') {
            p.prevPage();
          } else {
            p.nextPage();
          }
          break;
        case ' ':
          e.preventDefault();
          p.nextPage();
          break;
        case 'f':
          e.preventDefault();
          void p.toggleFullscreen();
          break;
        case 'b':
          e.preventDefault();
          p.toggleBookmark();
          break;
        case 's':
          e.preventDefault();
          p.setSettingsOpen(prev => !prev);
          break;
        case 'Home':
          e.preventDefault();
          p.goToPage(1);
          break;
        case 'End':
          e.preventDefault();
          p.goToPage(p.totalPages);
          break;
        case 'n':
          e.preventDefault();
          void p.nextChapter();
          break;
        case 'p':
          e.preventDefault();
          void p.prevChapter();
          break;
        case 'c':
          // Future: Open chapter list modal
          break;
        default:
          // No action for other keys
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled]); // Only re-attach when enabled changes
}
