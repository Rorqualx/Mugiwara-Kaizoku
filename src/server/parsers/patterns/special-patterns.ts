/**
 * Special Pattern Definitions
 *
 * Pattern collections for edge cases including arcs, editions,
 * URLs, and file patterns.
 *
 * Extracted from: PatternLibrary.ts (lines 346-401)
 */

import type { PatternCollection } from './types';

/**
 * Register special and edge case patterns
 * @param patterns - Map to populate with special patterns
 */
export function registerSpecialPatterns(patterns: Map<string, PatternCollection>): void {
  // ====== Arc Patterns ======
  patterns.set('arc', {
    primary: [
      /([^:]+)\s+Arc/i,
      /([^:]+)\s+Saga/i,
      /([^:]+)\s+Story/i,
      /Arc\s+(\d+)/i,
      /Season\s+(\d+)/i,
      /Part\s+(\d+)/i,
    ]
  });

  // ====== Special Editions ======
  patterns.set('edition', {
    primary: [
      /Limited\s+Edition/i,
      /Collector'?s?\s+Edition/i,
      /Special\s+Edition/i,
      /Deluxe\s+Edition/i,
      /Omnibus\s+Edition/i,
      /Digital\s+Edition/i,
      /Hardcover/i,
      /Paperback/i,
      /Tankobon/i,
      /Bunkoban/i,
      /Kanzenban/i,
    ]
  });

  // ====== URLs ======
  // FIXED: Removed unnecessary escape characters
  patterns.set('url', {
    primary: [
      /https?:\/\/[^\s<>"{}|\\^`[\]]+/i,  // Fixed: \[ → [, \] → ]
      /\/wiki\/([^/\s]+)/,                 // Fixed: \/ → /
      /\/manga\/([^/\s]+)/,                // Fixed: \/ → /
      /\/chapter\/([^/\s]+)/,              // Fixed: \/ → /
      /\/volume\/([^/\s]+)/,               // Fixed: \/ → /
    ]
  });

  // ====== File Patterns ======
  patterns.set('file', {
    primary: [
      /\.(jpg|jpeg|png|gif|webp)$/i,
      /\.(pdf|cbz|cbr|epub)$/i,
      /\[([^\]]+)\]/,                  // Scanlation group
      /\{([^}]+)\}/,                    // Quality/version
      /\(([^)]+)\)/,                    // Additional info
      /v(\d+)/i,                        // Version number
    ]
  });
}
