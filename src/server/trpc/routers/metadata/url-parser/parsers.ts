/**
 * URL Parser Functions
 *
 * Individual parser functions for different metadata URL types.
 * Each parser handles a specific provider and returns AsyncResult.
 *
 * Supported providers:
 * - Fandom wikis (fandom.com)
 * - AniList (anilist.co)
 * - ComicVine (comicvine.gamespot.com)
 * - Wikipedia (wikipedia.org)
 * - MyAnimeList (myanimelist.net)
 * - Direct image URLs (.jpg, .png, .gif, .webp)
 * - JSON URLs (.json)
 * - Generic HTML/JSON content
 */

import { createSuccessResult, createErrorResult, isSuccess, isError } from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';

import type { ParsedMetadataResult, Context } from './types';

/**
 * Parse Fandom wiki URL
 *
 * Uses dynamic import to avoid circular dependency with metadataRouter.
 * Delegates to fetchFandomMetadata procedure for actual parsing.
 *
 * @param url - Fandom wiki URL to parse
 * @param ctx - tRPC context for authenticated calls
 * @returns AsyncResult with parsed Fandom metadata
 */
export async function parseFandomUrl(
  url: string,
  ctx: Context
): Promise<AsyncResult<ParsedMetadataResult, Error>> {
  const { metadataRouter } = await import('../../metadata');
  const fandomResult = await metadataRouter.createCaller(ctx).fetchFandomMetadata({ url });

  if (isSuccess(fandomResult)) {
    return createSuccessResult({
      type: 'fandom',
      data: fandomResult.data,
      confidence: 0.9,
      parser: 'fandom',
    });
  }
  return createErrorResult(
    isError(fandomResult) ? (fandomResult.error as Error) : new Error('Failed to parse Fandom URL')
  );
}

/**
 * Parse AniList URL
 *
 * Uses dynamic import to avoid circular dependency with metadataRouter.
 * Delegates to fetchAnilistMetadata procedure for actual parsing.
 *
 * @param url - AniList URL to parse
 * @param ctx - tRPC context for authenticated calls
 * @returns AsyncResult with parsed AniList metadata
 */
export async function parseAnilistUrl(
  url: string,
  ctx: Context
): Promise<AsyncResult<ParsedMetadataResult, Error>> {
  const { metadataRouter } = await import('../../metadata');
  const anilistResult = await metadataRouter.createCaller(ctx).fetchAnilistMetadata({ url });

  if (isSuccess(anilistResult)) {
    return createSuccessResult({
      type: 'anilist',
      data: anilistResult.data,
      confidence: 0.95,
      parser: 'anilist',
    });
  }
  return createErrorResult(
    isError(anilistResult) ? (anilistResult.error as Error) : new Error('Failed to parse AniList URL')
  );
}

/**
 * Parse ComicVine URL
 *
 * Extracts volume ID from URL pattern and fetches volume data
 * from ComicVine API.
 *
 * @param url - ComicVine URL to parse (must contain volume ID in /XXXXX- format)
 * @returns AsyncResult with parsed ComicVine volume data
 */
export async function parseComicvineUrl(
  url: string
): Promise<AsyncResult<ParsedMetadataResult, Error>> {
  const match = url.match(/\/(\d+)-/);
  if (!match?.[1]) {
    return createErrorResult(new Error('Invalid ComicVine URL format'));
  }

  const volumeId = match[1];
  const { comicvineService } = await import('@/server/services/comicvine/service');
  const volumeResult = await comicvineService.getVolume(volumeId, '');

  if (!isSuccess(volumeResult as AsyncResult<unknown, unknown>)) {
    return createErrorResult(new Error('Failed to fetch ComicVine volume'));
  }

  const typedVolumeResult = volumeResult as AsyncResult<unknown, Error>;
  if (!isSuccess(typedVolumeResult)) {
    return createErrorResult(new Error('Failed to fetch ComicVine volume'));
  }

  return createSuccessResult({
    type: 'comicvine',
    data: typedVolumeResult.data,
    confidence: 0.85,
    parser: 'comicvine',
  });
}

/**
 * Parse Wikipedia URL
 *
 * Fetches HTML from Wikipedia and uses enhanced table parser
 * to extract volume data from manga/comic series pages.
 *
 * @param url - Wikipedia URL to parse
 * @returns AsyncResult with parsed Wikipedia volume data
 */
export async function parseWikipediaUrl(
  url: string
): Promise<AsyncResult<ParsedMetadataResult, Error>> {
  const axios = (await import('axios')).default;
  const response = await axios.get(url);
  const html: unknown = response.data;

  const { parseVolumeTablesEnhanced, parsePageAdaptive } = await import('@/server/services/metadata/utils/fandomTableParser');
  const htmlStr = typeof html === 'string' ? html : String(html);
  const volumeData = parseVolumeTablesEnhanced(htmlStr, parsePageAdaptive);

  return createSuccessResult({
    type: 'wikipedia',
    data: volumeData,
    confidence: 0.8,
    parser: 'wikipedia',
  });
}

/**
 * Parse MyAnimeList URL
 *
 * Extracts manga ID from MAL URL pattern.
 * Returns basic ID and URL data for further processing.
 *
 * @param url - MyAnimeList manga URL (must contain /manga/XXXXX)
 * @returns AsyncResult with parsed MAL ID and URL
 */
export async function parseMalUrl(
  url: string
): Promise<AsyncResult<ParsedMetadataResult, Error>> {
  // No-op await to satisfy @typescript-eslint/require-await
  await Promise.resolve();

  const match = url.match(/manga\/(\d+)/);
  if (!match) {
    return createErrorResult(new Error('Invalid MyAnimeList URL format'));
  }

  return createSuccessResult({
    type: 'mal',
    data: { id: match[1], url },
    confidence: 0.7,
    parser: 'mal',
  });
}

/**
 * Parse direct image URL
 *
 * Handles URLs pointing directly to image files.
 * Returns the URL as image data for cover/artwork usage.
 *
 * @param url - Direct image URL
 * @returns AsyncResult with image URL data
 */
export async function parseImageUrl(
  url: string
): Promise<AsyncResult<ParsedMetadataResult, Error>> {
  // No-op await to satisfy @typescript-eslint/require-await
  await Promise.resolve();

  return createSuccessResult({
    type: 'image',
    data: { imageUrl: url },
    confidence: 1.0,
    parser: 'image',
  });
}

/**
 * Parse JSON URL
 *
 * Fetches and parses JSON data from URL.
 * Useful for API endpoints or JSON metadata files.
 *
 * @param url - URL pointing to JSON content
 * @returns AsyncResult with parsed JSON data
 */
export async function parseJsonUrl(
  url: string
): Promise<AsyncResult<ParsedMetadataResult, Error>> {
  const axios = (await import('axios')).default;
  const response = await axios.get(url);
  const jsonData: unknown = response.data;

  return createSuccessResult({
    type: 'json',
    data: jsonData,
    confidence: 0.9,
    parser: 'json',
  });
}

/**
 * Parse generic URL (HTML/JSON/Image based on content-type)
 *
 * Fallback parser that determines content type from HTTP headers.
 * Handles JSON, HTML, and image responses with appropriate confidence levels.
 *
 * @param url - Generic URL to parse
 * @returns AsyncResult with parsed content based on detected type
 */
export async function parseGenericUrl(
  url: string
): Promise<AsyncResult<ParsedMetadataResult, Error>> {
  const axios = (await import('axios')).default;
  const response = await axios.get(url);
  const contentType = response.headers['content-type'] as unknown;
  const contentTypeStr = typeof contentType === 'string' ? contentType : '';

  if (contentTypeStr.includes('application/json')) {
    const jsonData: unknown = response.data;
    return createSuccessResult({
      type: 'json',
      data: jsonData,
      confidence: 0.7,
      parser: 'generic',
    });
  } else if (contentTypeStr.includes('text/html')) {
    const responseData: unknown = response.data;
    const htmlData =
      typeof responseData === 'string'
        ? responseData.substring(0, 10000)
        : String(responseData).substring(0, 10000);

    return createSuccessResult({
      type: 'html',
      data: { html: htmlData },
      confidence: 0.5,
      parser: 'generic',
    });
  } else if (contentTypeStr.includes('image/')) {
    return createSuccessResult({
      type: 'image',
      data: { imageUrl: url },
      confidence: 1.0,
      parser: 'generic',
    });
  }

  return createErrorResult(new Error('Unknown URL type'));
}

/**
 * Detect URL type based on URL pattern
 *
 * Analyzes URL string to determine the appropriate parser to use.
 * Used for routing URLs to their specific parsers.
 *
 * @param url - URL to analyze
 * @returns Parser type identifier string
 */
export function detectUrlType(url: string): string {
  if (url.includes('fandom.com')) return 'fandom';
  if (url.includes('anilist.co')) return 'anilist';
  if (url.includes('comicvine.gamespot.com')) return 'comicvine';
  if (url.includes('wikipedia.org')) return 'wikipedia';
  if (url.includes('myanimelist.net')) return 'mal';
  if (url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) return 'image';
  if (url.endsWith('.json')) return 'json';
  return 'generic';
}
