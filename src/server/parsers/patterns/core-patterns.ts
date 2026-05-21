/**
 * Core Pattern Definitions
 *
 * Core extraction patterns for common metadata fields including
 * volumes, chapters, status, ISBN, dates, genres, and people.
 *
 * Extracted from: PatternLibrary.ts (lines 48-263)
 */

import type { PatternCollection } from './types';

/**
 * Register core extraction patterns
 * @param patterns - Map to populate with core patterns
 */
export function registerCorePatterns(patterns: Map<string, PatternCollection>): void {
  // ====== Volume Patterns ======
  patterns.set('volume', {
    primary: [
      /Volume\s+(\d+\.?\d*)/i,
      /Vol\.?\s*(\d+\.?\d*)/i,
      /Tome\s+(\d+)/i,
      /Tomo\s+(\d+)/i,
      /Band\s+(\d+)/i,
      /Book\s+(\d+)/i,
      /Part\s+(\d+)/i,
    ],
    contextual: [
      {
        pattern: /(\d+)/,
        requiresContext: ['volume', 'vol', 'tome', 'tomo'],
        confidence: 0.7
      },
      {
        pattern: /\b(\d{1,3})\b/,
        requiresContext: ['volumes', 'books'],
        confidence: 0.6
      }
    ],
    special: [
      /Volume\s+(\d+)\.(\d+)/i,        // Decimal volumes
      /Volume\s+(\d+)\s*[–-]\s*(\d+)/i, // Volume ranges
      /[Vv](?:ol(?:ume)?s?)?[-.\s]*(\d+)\s*[-–]\s*(\d+)/,  // Compact volume ranges (Vols. 01-16, v01-05)
      /Omnibus\s+(\d+)/i,              // Omnibus editions
      /Box\s+Set\s+(\d+)/i,            // Box sets
      /[Kk]anzenban\s*(\d+)/,          // Japanese complete editions
      /Special\s+Volume/i,             // Special volumes
      /Volume\s+Zero/i,                // Volume 0
    ],
    negative: [
      /Volume\s+\d+\s+Extra/i,
      /Volume\s+\d+\s+Omake/i,
      /Behind\s+the\s+Scenes/i,
    ],
    validators: [
      {
        validate: (value) => {
          const num = parseInt(value, 10);
          return num >= 0 && num <= 999;
        }
      }
    ]
  });

  // ====== Chapter Patterns ======
  patterns.set('chapter', {
    primary: [
      /Chapter\s+(\d+(?:\.\d+)?)/i,
      /Ch\.?\s*(\d+(?:\.\d+)?)/i,
      /Episode\s+(\d+(?:\.\d+)?)/i,
      /Ep\.?\s*(\d+)/i,
      /Mission\s+(\d+)/i,
      /Quest\s+(\d+)/i,
      /Stage\s+(\d+)/i,
      /Round\s+(\d+)/i,
      /Match\s+(\d+)/i,
      /Night\s+(\d+)/i,
      /Day\s+(\d+)/i,
      /Page\s+(\d+)/i,
      /Act\s+(\d+)/i,
      /Scene\s+(\d+)/i,
      /#(\d+)/,
    ],
    contextual: [
      {
        pattern: /(\d+(?:\.\d+)?)/,
        requiresContext: ['chapter', 'ch', 'episode', 'ep'],
        confidence: 0.8
      },
      {
        pattern: /(\d{1,4})/,
        requiresContext: ['chapters', 'episodes', 'list'],
        confidence: 0.6
      }
    ],
    special: [
      /Chapter\s+(\d+)\.(\d+)/i,       // Decimal chapters
      /Chapter\s+(\d+)[a-z]/i,         // Letter suffix
      /Chapter\s+(\d+)\s*\+\s*(\d+)/i, // Chapter + extra
      /(\d\d\d?\d?)-(\d\d\d?\d?)(?:\.\d+)?\s+as\s+v/i,  // Chapter compilation (001-030 as v01)
      /\s(\d{1,4})-(\d{1,4})(?=\s*[([])/, // Chapter ranges at end (Title 001-030)
      /Extra\s+Chapter\s+(\d+)/i,      // Extra chapters
      /Special\s+Chapter/i,            // Special chapters
      /Prologue/i,                     // Prologue
      /Epilogue/i,                     // Epilogue
      /Chapter\s+Zero/i,               // Chapter 0
      /One[\s-]?Shot/i,                // One-shot
    ],
    validators: [
      {
        validate: (value) => {
          const num = parseFloat(value);
          return num >= 0 && num <= 9999;
        }
      }
    ]
  });

  // ====== Status Patterns ======
  patterns.set('status', {
    primary: [
      /\b(ongoing|on-going|on going)\b/i,
      /\b(completed?|finished?|ended?)\b/i,
      /\b(hiatus|suspended?|paused?)\b/i,
      /\b(cancelled?|canceled?|discontinued?|axed?)\b/i,
    ],
    contextual: [
      {
        pattern: /(active|current|present)/i,
        requiresContext: ['status', 'publication', 'serialization'],
        confidence: 0.8
      },
      {
        pattern: /(\d{4})\s*[-–—]\s*present/i,
        requiresContext: ['run', 'published', 'aired'],
        confidence: 0.9
      },
      {
        pattern: /(\d{4})\s*[-–—]\s*(\d{4})/i,
        requiresContext: ['run', 'published', 'aired'],
        confidence: 0.9
      }
    ]
  });

  // ====== ISBN Patterns ======
  patterns.set('isbn', {
    primary: [
      /ISBN[\s:]*([0-9]{13})/i,
      /ISBN[\s:]*([0-9]{10})/i,
      /ISBN-13[\s:]*([0-9-]{17})/i,
      /ISBN-10[\s:]*([0-9-]{13})/i,
      /978-?[0-9]{1,5}-?[0-9]{1,7}-?[0-9]{1,6}-?[0-9]/,
    ],
    validators: [
      {
        validate: (value) => {
          const isbn = value.replace(/[^0-9X]/gi, '');
          return isbn.length === 10 || isbn.length === 13;
        },
        transform: (value) => value.replace(/[^0-9X]/gi, '')
      }
    ]
  });

  // ====== Date Patterns ======
  patterns.set('date', {
    primary: [
      // ISO formats
      /(\d{4}-\d{2}-\d{2})/,
      /(\d{4}\/\d{2}\/\d{2})/,

      // US formats
      /(\d{1,2}\/\d{1,2}\/\d{4})/,
      /(\d{1,2}-\d{1,2}-\d{4})/,

      // European formats
      /(\d{1,2}\.\d{1,2}\.\d{4})/,
      /(\d{1,2}\s+\d{1,2}\s+\d{4})/,

      // Year in brackets (common in filenames)
      /[([{](\d{4})[)\]}]/,

      // Year range in brackets (2019-2023)
      /[([{](\d{4})[-–](\d{4})[)\]}]/,
    ],
    contextual: [
      {
        pattern: /(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/i,
        requiresContext: [],
        confidence: 1.0
      },
      {
        pattern: /\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+\d{4}/i,
        requiresContext: [],
        confidence: 1.0
      },
      {
        pattern: /(Spring|Summer|Fall|Autumn|Winter)\s+\d{4}/i,
        requiresContext: ['release', 'published'],
        confidence: 0.7
      },
      {
        // Bare year before metadata brackets (Title 2019 [Group])
        pattern: /\s(19\d\d|20\d\d)(?=\s*[([])/, // Year before opening bracket/paren
        requiresContext: [],
        confidence: 0.8
      }
    ],
    validators: [
      {
        validate: (value) => {
          const date = new Date(value);
          return !isNaN(date.getTime());
        }
      }
    ]
  });

  // ====== Genre Patterns ======
  patterns.set('genre', {
    primary: [
      /\b(action|adventure|comedy|drama|fantasy|horror|mystery|romance|sci-fi|science fiction|thriller)\b/i,
      /\b(shounen|shoujo|seinen|josei|kodomomuke)\b/i,
      /\b(slice of life|supernatural|psychological|historical|martial arts|mecha|sports)\b/i,
    ]
  });

  // ====== Author/Artist Patterns ======
  patterns.set('person', {
    primary: [
      // Japanese names
      /([A-Z][a-z]+)\s+([A-Z][a-z]+)/,
      /([A-Z]+[a-z]*)\s+([A-Z]+[a-z]*)/,

      // Pen names
      /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/,
    ],
    contextual: [
      {
        pattern: /by\s+([^,\n]+)/i,
        requiresContext: ['written', 'illustrated', 'created'],
        confidence: 0.9
      }
    ]
  });
}
