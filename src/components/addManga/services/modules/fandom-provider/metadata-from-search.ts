/**
 * Build metadata from search result data
 */

import type { ProviderMetadata } from '@/types/universalImportWizard.types';
import { logger } from '@/utils/logger';

import { extractArtists } from './artist-extraction';

/**
 * Build metadata from existing search result metadata
 */

/**
 * Get first non-empty string from candidates
 */
function getFirstNonEmpty(...candidates: (string | undefined | null)[]): string {
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.length > 0 && candidate !== 'No description available') {
      return candidate;
    }
  }
  return '';
}

// eslint-disable-next-line complexity -- Complex Fandom metadata extraction from search result
export function buildMetadataFromSearchResult(result: Record<string, unknown>): ProviderMetadata {
  const resultMetadata = (result['metadata'] ?? {}) as Record<string, unknown>;

  // Get first non-empty description (skip empty strings and placeholder text)
  const description = getFirstNonEmpty(
    resultMetadata['description'] as string | undefined,
    result['description'] as string | undefined,
    resultMetadata['abstract'] as string | undefined,
    result['abstract'] as string | undefined,
    resultMetadata['synopsis'] as string | undefined,
    result['synopsis'] as string | undefined
  );

  logger.warn('[Fandom] buildMetadataFromSearchResult', {
    resultDescription: result['description'],
    metadataDescription: resultMetadata['description'],
    resultSynopsis: result['synopsis'],
    extractedDescriptionLength: description.length,
    extractedDescriptionPreview: description.substring(0, 100),
  });

  const fandomMetadata = {
    id: (result['id'] ?? '') as string,
    sourceId: (result['sourceId'] ?? result['id'] ?? '') as string,
    title: (result['title'] ?? '') as string,
    description,
    synopsis: (resultMetadata['synopsis'] as string | undefined) ?? (description.length > 0 ? description : undefined),
    status: (result['status'] ?? '') as string,
    format: (result['format'] ?? result['type'] ?? resultMetadata['format'] ?? resultMetadata['type'] ?? 'MANGA') as string,
    genres: (result['genres'] ?? []) as string[],
    authors: (resultMetadata['authors'] ?? result['authors'] ?? (resultMetadata['author'] ? [resultMetadata['author']] : (result['author'] ? [result['author']] : []))) as string[],
    artists: extractArtists(resultMetadata, result),
    publisher: (resultMetadata['publisher'] ?? result['publisher'] ?? '') as string,
    demographic: (resultMetadata['demographic'] ?? result['demographic'] ?? '') as string | undefined,
    startDate: (resultMetadata['startDate'] ?? result['startDate'] ?? '') as string,
    endDate: (resultMetadata['endDate'] ?? result['endDate'] ?? '') as string,
    coverImage: (result['coverImage'] ?? '') as string | undefined,
    alternativeTitles: (resultMetadata['alternativeTitles'] ?? result['alternativeTitles'] ?? []) as string[],
    url: (result['url'] ?? result['wikiUrl'] ?? '') as string | undefined,
    wikiUrl: (result['wikiUrl'] ?? result['url'] ?? '') as string | undefined,
    volumes: resultMetadata['volumes'] ?? result['volumes'],
    chapters: resultMetadata['chapters'] ?? result['chapters'],
    volumeData: result['volumeData'] ?? [],
    chapterData: result['chapterData'] ?? [],
    rawData: resultMetadata['rawData'] ?? result['rawData'] ?? {}
  } as ProviderMetadata;

  // Store chapter data in rawData if not in chapterData
  const resultChapters = resultMetadata['chapters'] as unknown[] | undefined;
  if (Array.isArray(resultChapters) && !(fandomMetadata.chapterData as unknown[] | undefined)?.length) {
    fandomMetadata.rawData = { ...(fandomMetadata.rawData as Record<string, unknown>), chapters: resultChapters };
  }

  return fandomMetadata;
}
