/**
 * Volume and chapter count calculation utilities for Fandom provider
 */

/**
 * Calculate volume count from various data structures
 */
export function calculateVolumeCount(
  volumes: unknown,
  volumesAndChapters: Record<string, unknown> | undefined
): number {
  if (Array.isArray(volumes)) {
    return volumes.length;
  }
  if (volumesAndChapters && Array.isArray(volumesAndChapters['volumes'])) {
    return (volumesAndChapters['volumes'] as unknown[]).length;
  }
  if (volumesAndChapters && typeof volumesAndChapters['totalVolumes'] === 'number') {
    return volumesAndChapters['totalVolumes'];
  }
  if (typeof volumes === 'number') {
    return volumes;
  }
  return 0;
}

/**
 * Calculate chapter count from various data structures
 */
export function calculateChapterCount(
  chapters: unknown,
  volumesAndChapters: Record<string, unknown> | undefined
): number {
  if (Array.isArray(chapters)) {
    return chapters.length;
  }
  if (volumesAndChapters && Array.isArray(volumesAndChapters['chapters'])) {
    return (volumesAndChapters['chapters'] as unknown[]).length;
  }
  if (volumesAndChapters && typeof volumesAndChapters['totalChapters'] === 'number') {
    return volumesAndChapters['totalChapters'];
  }
  if (typeof chapters === 'number') {
    return chapters;
  }
  return 0;
}
