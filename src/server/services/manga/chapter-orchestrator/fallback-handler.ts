/**
 * Fallback Chapter Creation Handler
 * Handles fallback chapter creation when no provider data is available
 */

import type { ChapterCreationFunctions } from './types';

/**
 * Create fallback generic chapters from metadata
 * Complexity: 4
 */
export async function createFallbackChapters(
  context: unknown,
  mangaId: number,
  metadata: { chapters?: number; volumes?: number | null } | undefined,
  chapterCreationFunctions: ChapterCreationFunctions
): Promise<void> {
  if (!metadata?.chapters) {
    return;
  }

  await chapterCreationFunctions.createGenericChapters(
    context,
    mangaId,
    metadata.chapters,
    metadata.volumes ?? null
  );
}
