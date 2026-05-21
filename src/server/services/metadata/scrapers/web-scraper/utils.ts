/**
 * Web Scraper Utility Functions
 *
 * Shared utilities for URL resolution, date parsing, rate limiting,
 * and error handling used by the WebScraper class.
 *
 * Extracted from: WebScraper.ts (lines 345-393)
 */

/**
 * Resolve relative URLs to absolute URLs
 *
 * Handles various URL formats:
 * - Full URLs (http://, https://) - returned as-is
 * - Protocol-relative URLs (//) - prefixed with https:
 * - Root-relative URLs (/) - combined with base URL
 * - Relative URLs - combined with base URL
 *
 * @param url - The URL to resolve (can be relative or absolute)
 * @param baseUrl - The base URL to resolve against
 * @returns Resolved absolute URL
 */
export function resolveUrl(url: string, baseUrl: string): string {
  if (!url) {
    return '';
  }

  // Already a full URL
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  // Protocol-relative URL
  if (url.startsWith('//')) {
    return 'https:' + url;
  }

  // Root-relative URL
  if (url.startsWith('/')) {
    return baseUrl + url;
  }

  // Relative to base URL
  return baseUrl + '/' + url;
}

/**
 * Build manga URL from ID and base URL
 *
 * Constructs a standard manga detail page URL using the provider's
 * base URL and manga ID. This is a placeholder implementation that
 * can be overridden by concrete adapters.
 *
 * @param mangaId - The manga ID
 * @param baseUrl - The base URL of the provider
 * @returns Complete manga URL
 */
export function buildMangaUrl(mangaId: string, baseUrl: string): string {
  return `${baseUrl}/manga/${mangaId}`;
}

/**
 * Parse date string to Date object
 *
 * Attempts to parse various date formats using the native Date parser.
 * Returns null if parsing fails or results in an invalid date.
 *
 * @param dateStr - The date string to parse
 * @returns Parsed Date object or null if invalid
 */
export function parseDate(dateStr: string): Date | null {
  try {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Apply rate limiting delay
 *
 * Creates a delay based on the requested rate limit to prevent
 * overwhelming the target server. Uses a simple calculation:
 * delay = 1000ms / requestsPerSecond
 *
 * @param requestsPerSecond - Maximum requests allowed per second
 * @returns Promise that resolves after the delay
 */
export async function applyRateLimit(
  requestsPerSecond: number
): Promise<void> {
  const delay = 1000 / requestsPerSecond;
  await new Promise<void>((resolve) => {
    setTimeout(() => {
      resolve();
    }, delay);
  });
}

/**
 * Create error with optional cause
 *
 * Wraps error creation with proper cause chaining for better
 * error tracing and debugging. If a cause is provided and is
 * an Error instance, it will be attached to the error's cause property.
 *
 * @param message - The error message
 * @param cause - Optional underlying cause (typically another Error)
 * @returns Error object with cause if provided
 */
export function createError(message: string, cause?: unknown): Error {
  const error = new Error(message);
  if (cause && cause instanceof Error) {
    (error as Error & { cause: Error }).cause = cause;
  }
  return error;
}
