/**
 * URL Parser Types
 *
 * Shared types for metadata URL parsing operations.
 */

import type { Context } from '@/server/trpc/context';

/**
 * Parser result type for metadata URL parsing
 */
export interface ParsedMetadataResult {
  type: string;
  data: unknown;
  confidence: number;
  parser: string;
}

/**
 * Parser function signature
 *
 * Parsers return the result directly and throw on failure (converted to
 * TRPCError at the tRPC boundary).
 */
export type UrlParserFn = (
  url: string,
  ctx: Context
) => Promise<ParsedMetadataResult>;

/**
 * Supported URL types
 */
export type UrlType =
  | 'fandom'
  | 'anilist'
  | 'comicvine'
  | 'wikipedia'
  | 'mal'
  | 'image'
  | 'json'
  | 'html'
  | 'unknown';

/**
 * Re-export Context type for convenience
 */
export type { Context } from '@/server/trpc/context';
