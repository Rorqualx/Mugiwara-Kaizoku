/**
 * Input Parser Module
 *
 * Parses and validates input parameters for ComicVine metadata fetching.
 */

import { parseComicvineUrl } from './url-parser';

export interface ParsedInput {
  id: string;
  type: 'volume' | 'issue';
}

/**
 * Parse and validate input parameters
 * @param url - Optional ComicVine URL
 * @param id - Optional ComicVine ID
 * @param type - Default type if not determined from URL
 * @returns Parsed input or error message
 */
export function parseMetadataInput(
  url: string | undefined,
  id: string | undefined,
  type: 'volume' | 'issue'
): { success: true; data: ParsedInput } | { success: false; error: string } {
  let itemId: string | undefined = id;
  let itemType: 'volume' | 'issue' = type;

  if (url) {
    const parsed = parseComicvineUrl(url);
    if (!parsed) {
      return { success: false, error: 'Invalid ComicVine URL format' };
    }
    itemId = parsed.id;
    itemType = parsed.type;
  }

  if (!itemId) {
    return { success: false, error: 'ComicVine ID or URL is required' };
  }

  const numericId = parseInt(itemId, 10);
  if (isNaN(numericId)) {
    return { success: false, error: `Invalid ComicVine ID: ${itemId}` };
  }

  return {
    success: true,
    data: {
      id: String(numericId),
      type: itemType,
    },
  };
}
