/**
 * Metadata URL Parser Router
 *
 * Auto-detects provider type from URL and delegates to specialized parsers.
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

import { z } from 'zod';

import type { Context } from '@/server/trpc/context';
import { toTRPCError } from '@/server/trpc/errors';
import { publicProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';
import { logger } from '@/utils/logger';

import {
  detectUrlType,
  parseAnilistUrl,
  parseComicvineUrl,
  parseFandomUrl,
  parseGenericUrl,
  parseImageUrl,
  parseJsonUrl,
  parseMalUrl,
  parseWikipediaUrl,
} from './url-parser';

import type { ParsedMetadataResult } from './url-parser';

/**
 * Metadata URL Parser Router
 * Provides auto-detection and parsing of metadata URLs from multiple providers
 */
export const metadataUrlParserRouter = router({
  /**
   * Parse any metadata URL and extract relevant data
   *
   * Auto-detects provider type and delegates to specialized parsers.
   * Returns parsed metadata with confidence score and parser type.
   */
  parseMetadataUrl: publicProcedure
    .input(
      z.object({
        url: z.string().url(),
        field: z.string().optional(),
      })
    )
    .mutation(
      async ({
        input,
        ctx,
      }): Promise<ParsedMetadataResult> => {
        try {
          const { url, field } = input;
          logger.info(`Parsing metadata URL: ${url} for field: ${field ?? 'auto'}`);

          const urlType = detectUrlType(url);

          switch (urlType) {
            case 'fandom':
              return await parseFandomUrl(url, ctx as Context);
            case 'anilist':
              return await parseAnilistUrl(url, ctx as Context);
            case 'comicvine':
              return await parseComicvineUrl(url);
            case 'wikipedia':
              return await parseWikipediaUrl(url);
            case 'mal':
              return await parseMalUrl(url);
            case 'image':
              return await parseImageUrl(url);
            case 'json':
              return await parseJsonUrl(url);
            default:
              return await parseGenericUrl(url);
          }
        } catch (error: unknown) {
          logger.error(`Error parsing metadata URL: ${error instanceof Error ? error.message : String(error)}`);
          throw toTRPCError(
            error instanceof Error ? error : new Error(`Failed to parse metadata URL: ${String(error)}`)
          );
        }
      }
    ),
});
