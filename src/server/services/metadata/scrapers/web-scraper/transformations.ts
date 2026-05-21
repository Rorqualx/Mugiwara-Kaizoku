/**
 * Web Scraper Transformation Operations
 *
 * Handles text transformations for scraped data including regex,
 * replace, trim, prefix, suffix, split, join, match, capitalize.
 *
 * Extracted from: WebScraper.ts (lines 293-343)
 */

import type { Transform } from '@/types/adapters/native-download-types';

/**
 * Apply a series of transformations to a string value
 *
 * Processes transforms in order, each operating on the result of the previous.
 * Supports: regex, replace, trim, prefix, suffix, split, join, match, capitalize.
 */
export function applyTransformations(value: string, transforms: Transform[]): string {
  let result = value;

  for (const transform of transforms) {
    result = applySingleTransform(result, transform);
  }

  return result;
}

/**
 * Apply a single transformation (dispatcher)
 *
 * Routes transform to appropriate handler based on type.
 * Complexity: 10 (9 cases + default)
 */
function applySingleTransform(value: string, transform: Transform): string {
  switch (transform.type) {
    case 'regex':
      return applyRegexTransform(value, transform.params);
    case 'replace':
      return applyReplaceTransform(value, transform.params);
    case 'trim':
      return value.trim();
    case 'prefix':
      return applyPrefixTransform(value, transform.params);
    case 'suffix':
      return applySuffixTransform(value, transform.params);
    case 'split':
      return applySplitTransform(value, transform.params);
    case 'join':
      return value; // Used on array values
    case 'match':
      return applyMatchTransform(value, transform.params);
    case 'capitalize':
      return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
    default:
      return value; // Unknown transform type
  }
}

/**
 * Apply regex transformation
 *
 * Extracts value using regex pattern with optional flags.
 * Returns first capture group if present, otherwise full match.
 * Returns empty string if no match found.
 */
function applyRegexTransform(value: string, params: Record<string, unknown>): string {
  if (params["pattern"]) {
    const regex = new RegExp(
      params["pattern"] as string,
      params["flags"] as string | undefined
    );
    const match = value.match(regex);
    return match ? (match[1] ?? match[0]) : '';
  }
  return value;
}

/**
 * Apply replace transformation
 *
 * Replaces all matches of search pattern with replacement string.
 * Uses regex with flags (defaults to 'g' for global).
 */
function applyReplaceTransform(value: string, params: Record<string, unknown>): string {
  if (params["search"] && params["replace"] !== undefined) {
    const flags = (params["flags"] as string | undefined) ?? 'g';
    return value.replace(
      new RegExp(params["search"] as string, flags),
      params["replace"] as string
    );
  }
  return value;
}

/**
 * Apply prefix transformation
 *
 * Prepends a string value to the input.
 */
function applyPrefixTransform(value: string, params: Record<string, unknown>): string {
  if (params["value"]) {
    return (params["value"] as string) + value;
  }
  return value;
}

/**
 * Apply suffix transformation
 *
 * Appends a string value to the input.
 */
function applySuffixTransform(value: string, params: Record<string, unknown>): string {
  if (params["value"]) {
    return value + (params["value"] as string);
  }
  return value;
}

/**
 * Apply split transformation
 *
 * Splits string by separator and returns element at specified index.
 * Defaults to index 0 if not specified.
 * Returns empty string if index out of bounds.
 */
function applySplitTransform(value: string, params: Record<string, unknown>): string {
  if (params["separator"]) {
    const parts = value.split(params["separator"] as string);
    const index = (params["index"] as number | undefined) ?? 0;
    return parts[index] ?? '';
  }
  return value;
}

/**
 * Apply match transformation
 *
 * Tests if value matches pattern.
 * Returns value if matches, empty string if not.
 */
function applyMatchTransform(value: string, params: Record<string, unknown>): string {
  if (params["pattern"]) {
    const matchRegex = new RegExp(params["pattern"] as string);
    return matchRegex.test(value) ? value : '';
  }
  return value;
}
