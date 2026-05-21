/**
 * Assemble final metadata object for ComicVine
 */

import { stripHtml } from '@/lib/html-sanitizer';
import type { ProviderMetadata } from '@/types/universalImportWizard.types';
import { logger } from '@/utils/logger';

import type { ComicVineData } from './types';

// ============================================================================
// Helper Functions for Metadata Extraction
// ============================================================================

/**
 * Extract authors and artists from ComicVine person_credits
 */
function extractPeople(data: ComicVineData): { authors: string[]; artists: string[] } {
  const authors: string[] = [];
  const artists: string[] = [];

  if (!data.person_credits || !Array.isArray(data.person_credits)) {
    return { authors, artists };
  }

  for (const person of data.person_credits) {
    const name = person.name;
    const role = (person.role ?? '').toLowerCase();

    if (!name) continue;

    // Writer/Author roles
    if (role.includes('writer') || role.includes('author') || role.includes('story')) {
      if (!authors.includes(name)) authors.push(name);
    }

    // Artist roles
    if (role.includes('artist') || role.includes('pencil') || role.includes('ink') ||
        role.includes('color') || role.includes('cover')) {
      if (!artists.includes(name)) artists.push(name);
    }
  }

  return { authors, artists };
}

/**
 * Extract genres from ComicVine data
 */
function extractGenres(data: ComicVineData): string[] {
  if (!data.genres || !Array.isArray(data.genres)) {
    return [];
  }

  // The genres array is typed as Array<{ name: string }>, so we can safely map
  return data.genres.map(g => g.name);
}

// ============================================================================
// Main Metadata Assembly
// ============================================================================

/**
 * Build final metadata object to return
 */
// eslint-disable-next-line max-params, complexity -- Complex metadata assembly requires multiple data sources
export function buildReturnMetadata(
  volumeId: string | number,
  data: ComicVineData,
  result: Record<string, unknown>,
  alternativeTitles: string[],
  volumeCount: number,
  finalChapterCount: number,
  volumeData: unknown[],
  scrapedChapterData: unknown[],
  comicVineUrl: string | undefined
): ProviderMetadata {
  // Strip HTML tags from description to avoid displaying raw HTML entities
  const rawDescription = ((data["description"] ?? data.deck) ?? result["description"] ?? '') as string;
  const cleanDescription = rawDescription ? stripHtml(rawDescription) : '';

  // Extract additional metadata
  // Note: ComicVine doesn't provide reliable publication status, so we don't include it
  // The UI should use status from secondary sources (AniList, Fandom) if available
  const { authors, artists } = extractPeople(data);
  const genres = extractGenres(data);

  const returnData = {
    id: String(volumeId),
    sourceId: String(volumeId),
    title: (data["name"] ?? result["title"] ?? '') as string,
    description: cleanDescription,
    authors,
    artists,
    genres,
    publisher: (data.publisher?.name ?? result["publisher"] ?? '') as string,
    startDate: data.start_year ? `${data.start_year}-01-01` : '',
    coverImage: data.image?.original_url ?? data.image?.medium_url ?? result["coverImage"],
    url: (comicVineUrl ?? data.site_detail_url) as string | undefined,
    siteDetailUrl: (comicVineUrl ?? data.site_detail_url) as string | undefined,
    comicVineUrl: (comicVineUrl ?? data.site_detail_url) as string | undefined,
    alternativeTitles: Array.from(new Set(alternativeTitles)),
    volumes: volumeCount as number,
    chapters: finalChapterCount as number,
    volumeData: volumeData,
    chapterData: scrapedChapterData,
    scrapingStatus: volumeData.some((v: unknown) => (v as Record<string, unknown>)["status"] === 'scraped') ? 'complete' :
                    volumeData.some((v: unknown) => (v as Record<string, unknown>)["status"] === 'pending_scrape') ? 'pending' : 'none'
  };

  // DEBUG: Log assembled metadata
  logger.debug('[metadata-assembler] Assembled metadata:', {
    url: returnData.url,
    siteDetailUrl: returnData.siteDetailUrl,
    comicVineUrlParam: comicVineUrl,
    dataSiteDetailUrl: data.site_detail_url,
    title: returnData.title,
    publisher: returnData.publisher,
    dataPublisher: data.publisher,
    dataPublisherName: data.publisher?.name,
    resultPublisher: result["publisher"],
  });

  logger.info('[ComicVine] Returning metadata:', {
    id: returnData["id"],
    title: returnData["title"],
    volumes: returnData.volumes,
    chapters: returnData["chapters"],
    volumeDataLength: returnData.volumeData.length,
    volumeDataSample: returnData.volumeData[0],
    scrapingStatus: returnData.scrapingStatus,
    hasUrl: !!returnData.siteDetailUrl
  });

  return returnData as ProviderMetadata;
}
