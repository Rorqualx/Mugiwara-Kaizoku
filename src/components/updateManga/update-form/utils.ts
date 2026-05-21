/**
 * UpdateForm Utilities
 *
 * Pure utility functions for the UpdateForm component.
 * Extracted to reduce component complexity and improve testability.
 *
 * @module components/updateManga/update-form/utils
 */

import type { MangaWithRelations } from '@/types/search.types';

import type { MetadataWithCover } from './types';

/**
 * Extracts the cover URL from manga metadata with fallbacks
 *
 * @param manga - The manga object with potential cover fields
 * @returns The best available cover URL or fallback
 */
export function getCoverUrl(manga: MangaWithRelations, mangaId?: number): string {
  const metadata = manga.Metadata as MetadataWithCover | null | undefined;

  const raw =
    metadata?.cover ??
    metadata?.coverImage ??
    manga.Metadata?.coverLarge ??
    manga.Metadata?.coverMedium ??
    manga.Metadata?.coverSmall ??
    null;

  if (!raw) {
    if (mangaId !== undefined) return `/api/local-cover/${mangaId}`;
    return '/cover-not-found.jpg';
  }
  return raw;
}
