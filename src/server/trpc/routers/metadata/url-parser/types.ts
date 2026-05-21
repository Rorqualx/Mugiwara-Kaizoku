/**
 * URL Parser Types
 *
 * Shared types for metadata URL parsing operations.
 */

import type { Context } from '@/server/trpc/context';
import type { AsyncResult } from '@/utils/async-result';

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
 */
export type UrlParserFn = (
  url: string,
  ctx: Context
) => Promise<AsyncResult<ParsedMetadataResult, Error>>;

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
