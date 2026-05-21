/**
 * Hook for gallery navigation logic
 * Handles image selection, navigation, and keyboard controls
 */

import { useState, useCallback } from 'react';

import { useHotkeys } from '@mantine/hooks';

export interface UseGalleryNavigationOptions {
  /** Total number of images */
  imageCount: number;
}

export interface UseGalleryNavigationReturn {
  /** Currently selected image index */
  selectedIndex: number | null;
  /** Set selected image index */
  setSelectedIndex: (index: number | null) => void;
  /** Navigate to previous image */
  navigatePrevious: () => void;
  /** Navigate to next image */
  navigateNext: () => void;
  /** Close the gallery */
  closeGallery: () => void;
}

export function useGalleryNavigation({
  imageCount
}: UseGalleryNavigationOptions): UseGalleryNavigationReturn {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // Navigation handlers
  const navigatePrevious = useCallback(() => {
    if (selectedIndex === null) return;
    const newIndex = selectedIndex > 0 ? selectedIndex - 1 : imageCount - 1;
    setSelectedIndex(newIndex);
  }, [selectedIndex, imageCount]);

  const navigateNext = useCallback(() => {
    if (selectedIndex === null) return;
    const newIndex = selectedIndex < imageCount - 1 ? selectedIndex + 1 : 0;
    setSelectedIndex(newIndex);
  }, [selectedIndex, imageCount]);

  const closeGallery = useCallback(() => {
    setSelectedIndex(null);
  }, []);

  // Keyboard navigation
  useHotkeys([
    ['ArrowLeft', navigatePrevious],
    ['ArrowRight', navigateNext],
    ['Escape', closeGallery]
  ]);

  return {
    selectedIndex,
    setSelectedIndex,
    navigatePrevious,
    navigateNext,
    closeGallery
  };
}