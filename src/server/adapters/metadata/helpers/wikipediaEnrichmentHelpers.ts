/**
 * Wikipedia Enrichment Helpers
 *
 * Utility functions for enriching metadata with Wikipedia data.
 * Extracted from wikipediaAdapter.ts to reduce complexity.
 */

import type { WikipediaMangaData } from '@/server/services/wikipedia/wikipedia/service';

/**
 * Merge description fields with priority order:
 * existing → wiki plot → wiki description
 */
export function mergeDescription(
  existing: string | undefined,
  wikiPlot: string | undefined,
  wikiDesc: string | undefined
): string {
  return existing ?? wikiPlot ?? wikiDesc ?? '';
}

/**
 * Merge author/artist fields
 * Priority: existing field → wiki field joined by comma
 */
export function mergeCreatorField(
  existing: string | undefined,
  wikiCreators: string[] | undefined
): string {
  return existing ?? wikiCreators?.join(', ') ?? '';
}

/**
 * Merge genre arrays
 * Priority: existing (if non-empty) → wiki genres
 */
export function mergeGenres(
  existing: string[] | undefined,
  wikiGenres: string[] | undefined
): string[] {
  return existing && existing.length > 0 ? existing : wikiGenres ?? [];
}

/**
 * Merge metadata objects with Wikipedia enrichment
 */
export function mergeMetadata(
  existing: Record<string, unknown> | undefined,
  wikiData: WikipediaMangaData
): Record<string, unknown> {
  return {
    ...(existing ?? {}),
    wikipediaUrl: wikiData.wikipediaUrl,
    originalRun: wikiData.originalRun,
    demographic: wikiData.demographic,
    magazine: wikiData.magazine,
    volumeList: wikiData.volumeList,
    chapterList: wikiData.chapterList,
    enrichedWithWikipedia: true
  };
}
