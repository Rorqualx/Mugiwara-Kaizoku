/**
 * Language-Specific Pattern Definitions
 *
 * Pattern collections for language-specific metadata extraction
 * supporting Japanese, French, German, Spanish, Korean, and Chinese.
 *
 * Extracted from: PatternLibrary.ts (lines 265-344)
 */

import type { PatternCollection } from './types';

/**
 * Register language-specific extraction patterns
 * @param patterns - Map to populate with language patterns
 */
export function registerLanguagePatterns(patterns: Map<string, PatternCollection>): void {
  // ====== Japanese Patterns ======
  patterns.set('japanese', {
    primary: [
      /第(\d+)巻/,          // Volume
      /第(\d+)話/,          // Chapter/Episode
      /第(\d+)章/,          // Chapter
      /(\d+)巻/,           // Volume (simple)
      /(\d+)話/,           // Episode (simple)
      /連載中/,             // Ongoing
      /完結/,              // Completed
      /休載/,              // Hiatus
    ]
  });

  // ====== French Patterns ======
  patterns.set('french', {
    primary: [
      /Tome\s+(\d+)/i,
      /Chapitre\s+(\d+)/i,
      /Épisode\s+(\d+)/i,
      /en cours/i,
      /terminé/i,
      /en pause/i,
    ]
  });

  // ====== German Patterns ======
  patterns.set('german', {
    primary: [
      /Band\s+(\d+)/i,
      /Kapitel\s+(\d+)/i,
      /Folge\s+(\d+)/i,
      /laufend/i,
      /abgeschlossen/i,
      /pausiert/i,
    ]
  });

  // ====== Spanish Patterns ======
  patterns.set('spanish', {
    primary: [
      /Tomo\s+(\d+)/i,
      /Capítulo\s+(\d+)/i,
      /Episodio\s+(\d+)/i,
      /en curso/i,
      /finalizado/i,
      /en pausa/i,
    ]
  });

  // ====== Korean Patterns ======
  patterns.set('korean', {
    primary: [
      /제(\d+)권/,          // Volume
      /제(\d+)화/,          // Chapter/Episode
      /(\d+)권/,           // Volume (simple)
      /(\d+)화/,           // Episode (simple)
      /연재중/,             // Ongoing
      /완결/,              // Completed
      /휴재/,              // Hiatus
    ]
  });

  // ====== Chinese Patterns ======
  patterns.set('chinese', {
    primary: [
      /第(\d+)卷/,          // Volume
      /第(\d+)话/,          // Chapter/Episode
      /第(\d+)章/,          // Chapter
      /连载中/,             // Ongoing (simplified)
      /連載中/,             // Ongoing (traditional)
      /完结/,              // Completed
      /休载/,              // Hiatus
    ]
  });
}
