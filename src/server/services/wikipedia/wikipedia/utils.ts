/**
 * Wikipedia Utilities Module
 *
 * Shared helper functions and utilities used across all Wikipedia service modules.
 * Provides cache management, HTML processing, and text cleaning utilities.
 *
 * Extracted from: WikipediaService.ts
 */

import type { Cache } from './types';

// ============================================================================
// Constants
// ============================================================================

/**
 * Wikipedia MediaWiki API base URL
 */
export const API_BASE = 'https://en.wikipedia.org/w/api.php';

// ============================================================================
// Cache Utilities
// ============================================================================

/**
 * Creates a simple TTL-based cache using Map
 * @param ttl Time to live in milliseconds (default: 1 hour)
 * @returns Cache instance with set, get, clear methods
 */
export function createCache<T>(ttl: number = 3600000): Cache<T> {
  const cache = new Map<
    string,
    {
      value: T;
      expires: number;
    }
  >();

  return {
    get(key: string): T | undefined {
      const item = cache.get(key);
      if (!item) return undefined;

      if (Date.now() > item.expires) {
        cache.delete(key);
        return undefined;
      }

      return item.value;
    },
    set(key: string, value: T): void {
      cache.set(key, { value, expires: Date.now() + ttl });
    },
    has(key: string): boolean {
      return this.get(key) !== undefined;
    },
    clear(): void {
      cache.clear();
    },
  };
}

// ============================================================================
// HTML Processing
// ============================================================================

/**
 * Strips HTML tags and decodes entities from text
 * @param html Input HTML string
 * @returns Plain text without HTML tags
 */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

// ============================================================================
// Text Cleaning
// ============================================================================

/**
 * Cleans chapter titles by removing common artifacts
 * @param title Raw chapter title
 * @returns Cleaned chapter title
 */
export function cleanChapterTitle(title: string): string {
  const cleaned = title
    .replace(/^["''""]|["''""]$/g, '') // Remove surrounding quotes
    .replace(/\s*\([^)]*\)$/g, '') // Remove trailing parenthetical (Japanese text)
    .replace(/^Chapter\s+\d+:\s*/i, '') // Remove "Chapter N:" prefix
    .replace(/^Episode\s+\d+:\s*/i, '') // Remove "Episode N:" prefix
    .replace(/^Part\s+\d+:\s*/i, '') // Remove "Part N:" prefix
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/Japanese-language text/gi, '') // Remove placeholder text
    .replace(/^(ja|en|jp|ko|zh)$/i, '') // Remove language codes
    .trim();

  // Reject if the cleaned title looks like a CSS class or DOM artifact
  if (/^[a-z]+-[a-z]+(-[a-z]+)*$/.test(cleaned.toLowerCase()) && cleaned.length < 40) return '';
  if (/^mw-/i.test(cleaned) || /^\/wiki\//i.test(cleaned) || /^infobox/i.test(cleaned)) return '';

  // Reject CSS content (inline styles, selectors, property values)
  if (/[{};]/.test(cleaned)) return '';
  if (/\.mw-parser-output|background[-:]|font-size:|padding:|margin:/.test(cleaned)) return '';

  // Reject excessively long titles (real chapter titles are rarely >200 chars)
  if (cleaned.length > 200) return '';

  return cleaned;
}
