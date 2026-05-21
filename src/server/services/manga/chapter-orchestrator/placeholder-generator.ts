/**
 * Placeholder Chapter Generator
 * Creates placeholder chapters when no source data is available
 */

import type { ImportProfile } from './types';

interface PlaceholderChapter {
  chapterNumber: number;
  title: string;
  index: number;
  number: string;
}

/**
 * Generate placeholder chapters from import profile
 * Complexity: 3
 */
export function generatePlaceholderChapters(
  importProfile: ImportProfile
): PlaceholderChapter[] | undefined {
  const selectedChapters = importProfile['selectedChapters'];

  if (!selectedChapters || typeof selectedChapters !== 'number' || selectedChapters <= 0) {
    return undefined;
  }

  return Array.from({ length: selectedChapters }, (_, i) => ({
    chapterNumber: i + 1,
    title: `Chapter ${i + 1}`,
    index: i + 1,
    number: String(i + 1)
  }));
}
