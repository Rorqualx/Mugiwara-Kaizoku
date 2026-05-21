/**
 * Metadata Fandom Fetch Router
 *
 * This module provides tRPC procedures for fetching enhanced metadata from Fandom wikis.
 * It handles:
 * - Cover image extraction (multiple fallback strategies)
 * - Description extraction via extractFullDescription utility
 * - Alternative titles extraction
 * - Genre parsing from infobox
 * - Author/writer parsing
 * - Status extraction
 * - Cheerio-based HTML parsing
 *
 * Extracted from main metadata router for better modularity.
 */

import { z } from 'zod';

import { publicProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import {
  extractCoverImage,
  extractGenres,
  extractAuthors,
  extractStatus,
  extractAlternativeTitles,
  extractMyAnimeListUrl,
  extractOriginalRun,
} from './extractors';
import { buildFandomMetadataResult } from './result-builder';

import type { FandomMetadata } from './types';

/**
 * Validate that URL is a Fandom wiki URL
 */
function validateFandomUrl(url: string): boolean {
  return url.includes('fandom.com');
}

/**
 * Parse Fandom URL to extract wiki subdomain and page title
 */
function parseFandomUrl(url: string): { subdomain: string; pageTitle: string } | null {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;

    // Extract subdomain from hostname (e.g., "fire-force.fandom.com" -> "fire-force")
    const subdomainMatch = hostname.match(/^([^.]+)\.fandom\.com$/);
    if (!subdomainMatch) {
      return null;
    }
    const subdomain = subdomainMatch[1];

    // Extract page title from path (e.g., "/wiki/Fire_Force_(manga)" -> "Fire_Force_(manga)")
    const pathMatch = urlObj.pathname.match(/^\/wiki\/(.+)$/);
    if (!pathMatch?.[1]) {
      return null;
    }
    const pageTitle = decodeURIComponent(pathMatch[1]);

    return { subdomain: subdomain ?? '', pageTitle };
  } catch {
    return null;
  }
}

/**
 * Fetch HTML content using MediaWiki API parse action (bypasses Cloudflare)
 *
 * Instead of directly fetching the page URL (which gets blocked by Cloudflare),
 * we use the MediaWiki API's parse action which returns rendered HTML.
 */
async function fetchHtmlContent(url: string): Promise<string> {
  const axios = (await import('axios')).default;

  // Parse the Fandom URL to get subdomain and page title
  const parsed = parseFandomUrl(url);
  if (!parsed) {
    throw new Error(`Invalid Fandom URL format: ${url}`);
  }

  const { subdomain, pageTitle } = parsed;

  // Use MediaWiki API to get parsed HTML
  const apiUrl = `https://${subdomain}.fandom.com/api.php`;
  const params = new URLSearchParams({
    action: 'parse',
    page: pageTitle,
    prop: 'text',
    format: 'json'
  });

  logger.debug('[Fandom Server] Using MediaWiki API:', `${apiUrl}?${params}`);

  const response = await axios.get(`${apiUrl}?${params}`, {
    headers: {
      'User-Agent': 'MugiwaraKaizoku/1.0 (manga-metadata-fetcher)'
    },
    timeout: 30000
  });

  const data = response.data as { parse?: { text?: { '*'?: string } }; error?: { info?: string } };

  if (data.error) {
    throw new Error(`MediaWiki API error: ${data.error.info ?? 'Unknown error'}`);
  }

  const html = data.parse?.text?.['*'];
  if (!html) {
    throw new Error('No HTML content returned from MediaWiki API');
  }

  logger.debug('[Fandom Server] MediaWiki API returned HTML, length:', html.length);

  return html;
}

/**
 * Fandom metadata fetch router
 */
export const metadataFandomFetchRouter = router({
  /**
   * Fetch enhanced metadata from a Fandom URL (cover, description, etc.)
   */
  fetchFandomMetadata: publicProcedure
    .input(z.object({
      url: z.string().url()
    }))
    // eslint-disable-next-line complexity -- Pre-existing complexity from metadata extraction; would require major refactor
    .mutation(async ({ input }): Promise<AsyncResult<FandomMetadata, Error>> => {
      try {
        const { url } = input;

        logger.debug('[Fandom Server] fetchFandomMetadata called for URL:', url);

        // Validate it's a Fandom URL
        if (!validateFandomUrl(url)) {
          logger.debug('[Fandom Server] URL validation FAILED:', url);
          return createErrorResult(new Error('Not a valid Fandom wiki URL'));
        }

        logger.debug('[Fandom Server] URL validation passed, fetching page...');
        logger.info(`Fetching enhanced metadata from: ${url}`);

        // Import required modules
        const cheerioModule = await import('cheerio');
        const fandomUtils = await import('@/server/services/metadata/utils/fandomTableParser');
        const extractFullDescription = fandomUtils.extractFullDescription;

        // Fetch the page
        const html = await fetchHtmlContent(url);
        const $ = cheerioModule.load(html);

        // Extract all metadata components
        const cover = extractCoverImage($);
        const description = extractFullDescription(html);
        const alternativeTitles = extractAlternativeTitles($);
        const genres = extractGenres($);
        const authors = extractAuthors($);
        const status = extractStatus($);
        const { url: myAnimeListUrl, id: myAnimeListId } = extractMyAnimeListUrl($);
        const { startDate, endDate } = extractOriginalRun($);

        // Extract title from page title or first alternative title
        const parsedUrl = parseFandomUrl(url);
        const pageTitle = parsedUrl?.pageTitle.replace(/_/g, ' ').replace(/\s*\([^)]*\)$/, '').trim();
        const title = alternativeTitles[0] ?? pageTitle;

        logger.info(`[Fandom Server] Extracted metadata:`, {
          cover: cover ?? 'No cover found',
          description: description ? `${description.length} chars` : 'No',
          alternativeTitles: alternativeTitles,
          alternativeTitlesCount: alternativeTitles.length,
          genres: genres,
          genresCount: genres.length,
          authors: authors,
          authorsCount: authors.length,
          status: status ?? 'Not found',
          myAnimeListUrl: myAnimeListUrl ?? 'Not found',
          myAnimeListId: myAnimeListId ?? 'Not found',
          startDate: startDate ?? 'Not found',
          endDate: endDate ?? 'Not found'
        });

        // Build and return result
        const result = buildFandomMetadataResult({
          url,
          ...(title !== undefined && { title }),
          ...(cover !== undefined && { cover }),
          description,
          alternativeTitles,
          genres,
          authors,
          ...(status !== undefined && { status }),
          ...(myAnimeListUrl !== undefined && { myAnimeListUrl }),
          ...(myAnimeListId !== undefined && { myAnimeListId }),
          ...(startDate !== undefined && { startDate }),
          ...(endDate !== undefined && { endDate })
        });

        return createSuccessResult(result);
      } catch (error: unknown) {
        logger.error(`Error fetching Fandom metadata: ${error instanceof Error ? error.message : String(error)}`);
        return createErrorResult(
          error instanceof Error ?
            error :
            new Error(`Failed to fetch Fandom metadata: ${String(error)}`)
        );
      }
    }),
});

// Re-export types for convenience
export type { FandomMetadata } from './types';
