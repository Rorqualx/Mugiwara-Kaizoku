/**
 * MangaDex Client Helpers
 *
 * Helper functions for extracting data from MangaDex API responses.
 *
 * @module server/services/mangadex/client/helpers
 */

import type {
  MangaDexManga,
  MangaDexChapter,
  MangaDexScanlationGroup
} from '../types';

/**
 * Build full image URL for a chapter page
 */
export function buildImageUrl(
  baseUrl: string,
  hash: string,
  filename: string,
  dataSaver: boolean = false
): string {
  const quality = dataSaver ? 'data-saver' : 'data';
  return `${baseUrl}/${quality}/${hash}/${filename}`;
}

/**
 * Get English title from manga, with fallbacks
 */
export function getEnglishTitle(manga: MangaDexManga): string {
  const titles = manga.attributes.title;

  if (titles['en']) return titles['en'];
  if (titles['ja-ro']) return titles['ja-ro'];
  if (titles['ja']) return titles['ja'];

  // Return first available title
  const firstTitle = Object.values(titles).find(title => title !== undefined);
  return firstTitle ?? 'Unknown Title';
}

/**
 * Get English description from manga
 */
export function getEnglishDescription(manga: MangaDexManga): string {
  const descriptions = manga.attributes.description;
  return descriptions['en'] ?? descriptions['ja-ro'] ?? descriptions['ja'] ?? '';
}

/**
 * Extract cover URL from manga relationships
 */
export function extractCoverUrl(
  manga: MangaDexManga,
  size: '512' | '256' | 'original' = '512'
): string | null {
  const coverRel = manga.relationships.find(rel => rel.type === 'cover_art');
  if (!coverRel) return null;

  // Check if the relationship has attributes (expanded)
  const attrs = coverRel.attributes as { fileName?: string } | undefined;
  if (!attrs?.fileName) return null;

  const baseUrl = 'https://uploads.mangadex.org/covers';
  const fileName = attrs.fileName;

  switch (size) {
    case 'original':
      return `${baseUrl}/${manga.id}/${fileName}`;
    case '512':
      return `${baseUrl}/${manga.id}/${fileName}.512.jpg`;
    case '256':
      return `${baseUrl}/${manga.id}/${fileName}.256.jpg`;
    default:
      return `${baseUrl}/${manga.id}/${fileName}.512.jpg`;
  }
}

/**
 * Extract authors and artists from manga relationships
 */
export function extractCreators(manga: MangaDexManga): { authors: string[]; artists: string[] } {
  const authors: string[] = [];
  const artists: string[] = [];

  for (const rel of manga.relationships) {
    const attrs = rel.attributes as { name?: string } | undefined;
    if (!attrs?.name) continue;

    if (rel.type === 'author') {
      authors.push(attrs.name);
    } else if (rel.type === 'artist') {
      artists.push(attrs.name);
    }
  }

  return { authors, artists };
}

/**
 * Extract scanlation groups from chapter relationships
 */
export function extractScanlationGroups(chapter: MangaDexChapter): MangaDexScanlationGroup[] {
  const groups: MangaDexScanlationGroup[] = [];

  for (const rel of chapter.relationships) {
    if (rel.type !== 'scanlation_group') continue;

    const attrs = rel.attributes as {
      name?: string;
      description?: string;
      website?: string;
      discord?: string;
      twitter?: string;
      focusedLanguages?: string[];
      official?: boolean;
      inactive?: boolean;
      publishDelay?: number;
    } | undefined;

    if (attrs?.name) {
      groups.push({
        id: rel.id,
        name: attrs.name,
        description: attrs.description,
        website: attrs.website,
        discord: attrs.discord,
        twitter: attrs.twitter,
        focusedLanguages: attrs.focusedLanguages ?? [],
        isOfficial: attrs.official ?? false,
        isInactive: attrs.inactive ?? false,
        uploadDelay: attrs.publishDelay
      });
    }
  }

  return groups;
}
