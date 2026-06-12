/**
 * Provider-Specific URL Parsers
 *
 * Handles parsing and metadata extraction for different providers
 * (Fandom, AniList, ComicVine, Wikipedia, MyAnimeList).
 *
 * Extracted from: urlParsingService.ts (lines 139-212)
 */

import { logger } from '@/utils/logger';

import { type UrlParsingServiceConfig } from './utils';

// ============================================================================
// Provider Parsers
// ============================================================================

/**
 * Provider-specific URL parsing functionality
 *
 * Note: tRPC metadata procedures return the bare payload and throw a
 * TRPCError on failure — callers should use try/catch.
 */
export class ProviderParsers {
  private mutations: UrlParsingServiceConfig;

  constructor(mutations: UrlParsingServiceConfig) {
    this.mutations = mutations;
  }

  /**
   * Parse Fandom URL with fallback to basic parsing
   *
   * Attempts enhanced Fandom parsing first, falls back to basic parsing if it fails.
   *
   * @param url - Fandom URL to parse
   * @returns Parsed metadata (throws if both parsers fail)
   */
  async parseFandomUrl(url: string): Promise<unknown> {
    // Use standard Fandom parsing
    try {
      return await (this.mutations.fetchFandomMutation as { mutateAsync: (input: { url: string }) => Promise<unknown> }).mutateAsync({
        url
      });
    } catch (error) {
      logger.warn('Enhanced Fandom parsing failed, trying basic parsing:', error);
    }

    // Fallback to basic parsing
    return (this.mutations.parseFandomUrlMutation as { mutateAsync: (input: { url: string }) => Promise<unknown> }).mutateAsync({ url });
  }

  /**
   * Parse AniList URL and extract manga metadata
   *
   * Extracts the manga ID from the URL and fetches metadata from AniList.
   *
   * @param url - AniList URL to parse (e.g., https://anilist.co/manga/12345)
   * @returns Metadata (throws on failure)
   * @throws Error if URL format is invalid
   */
  async parseAnilistUrl(url: string): Promise<unknown> {
    // Extract ID from URL
    const idMatch = url.match(/manga\/(\d+)/);
    if (!idMatch?.[1]) {
      throw new Error('Invalid AniList URL');
    }

    const id = parseInt(idMatch[1], 10);
    return (this.mutations.fetchAnilistMutation as { mutateAsync: (input: { id: number }) => Promise<unknown> }).mutateAsync({ id });
  }

  /**
   * Parse ComicVine URL and extract volume metadata
   *
   * Extracts the volume ID from the URL and fetches metadata from ComicVine.
   *
   * @param url - ComicVine URL to parse (e.g., https://comicvine.gamespot.com/volume/4050-12345)
   * @returns Metadata (throws on failure)
   * @throws Error if URL format is invalid
   */
  async parseComicvineUrl(url: string): Promise<unknown> {
    // Extract volume ID from URL
    const volumeMatch = url.match(/4050-(\d+)/);
    if (!volumeMatch?.[1]) {
      throw new Error('Invalid ComicVine URL');
    }

    const volumeId = volumeMatch[1];
    return (this.mutations.fetchComicvineMutation as { mutateAsync: (input: { volumeId: string }) => Promise<unknown> }).mutateAsync({ volumeId });
  }

  /**
   * Parse Wikipedia URL
   *
   * Uses the generic URL parser for Wikipedia URLs.
   *
   * @param url - Wikipedia URL to parse
   * @returns Parsed metadata (throws on failure)
   */
  async parseWikipediaUrl(url: string): Promise<unknown> {
    return (this.mutations.parseUrlMutation as { mutateAsync: (input: { url: string }) => Promise<unknown> }).mutateAsync({ url });
  }

  /**
   * Detect provider from URL pattern
   *
   * Analyzes the URL to determine which metadata provider it belongs to.
   *
   * @param url - URL to analyze
   * @returns Provider name ('fandom', 'anilist', 'comicvine', 'wikipedia', 'myanimelist', or 'unknown')
   */
  detectProviderFromUrl(url: string): string {
    if (url.includes('fandom.com') || url.includes('wikia.com')) {
      return 'fandom';
    }
    if (url.includes('anilist.co')) {
      return 'anilist';
    }
    if (url.includes('comicvine.gamespot.com')) {
      return 'comicvine';
    }
    if (url.includes('wikipedia.org')) {
      return 'wikipedia';
    }
    if (url.includes('myanimelist.net')) {
      return 'myanimelist';
    }
    return 'unknown';
  }
}
