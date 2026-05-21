/**
 * Naming Conventions for Chapter Identifiers
 *
 * Defines non-standard chapter naming conventions used by different manga/novels.
 * Examples: Stage (Evangelion), Mission (Spy x Family), Episode (manhwa), etc.
 *
 * These patterns are used across the codebase for:
 * - Filename parsing (MangaFileParser)
 * - Fandom wiki parsing
 * - ComicVine chapter extraction
 * - General chapter number detection
 *
 * @module server/parsers/patterns/naming-conventions
 */

/**
 * Supported naming conventions with detection patterns.
 */
export interface NamingConvention {
  /** Primary name (e.g., 'stage', 'mission') */
  name: string;
  /** Display name for logging */
  displayName: string;
  /** Regex patterns to detect this convention (capture group 1 = number) */
  patterns: RegExp[];
  /** URL patterns to look for in hrefs */
  urlPatterns: RegExp[];
  /** Category patterns (wiki categories) */
  categoryPatterns: RegExp[];
}

/**
 * All supported naming conventions.
 * Ordered by specificity (more specific first to avoid false positives).
 */
export const NAMING_CONVENTIONS: NamingConvention[] = [
  {
    name: 'stage',
    displayName: 'Stage',
    patterns: [
      /Stage\.?\s*(\d+(?:\.\d+)?)/i,
      /ステージ\s*(\d+)/,
    ],
    urlPatterns: [
      /Stage[_\s]?(\d+)/i,
      /stage(\d+)/i,
    ],
    categoryPatterns: [
      /Category:Stages/i,
    ],
  },
  {
    name: 'mission',
    displayName: 'Mission',
    patterns: [
      /Mission\s*(\d+(?:\.\d+)?)/i,
      /ミッション\s*(\d+)/,
    ],
    urlPatterns: [
      /Mission[_\s]?(\d+)/i,
    ],
    categoryPatterns: [
      /Category:Missions/i,
    ],
  },
  {
    name: 'episode',
    displayName: 'Episode',
    patterns: [
      /Episode\s*(\d+(?:\.\d+)?)/i,
      /Ep\.?\s*(\d+(?:\.\d+)?)/i,
      /第(\d+)話/,
      /第(\d+)话/,
      /(\d+)話/,
      /(\d+)话/,
    ],
    urlPatterns: [
      /Episode[_\s]?(\d+)/i,
      /Ep[_\s]?(\d+)/i,
    ],
    categoryPatterns: [
      /Category:Episodes/i,
    ],
  },
  {
    name: 'case',
    displayName: 'Case',
    patterns: [
      /Case\s*(\d+(?:\.\d+)?)/i,
      /File\s*(\d+(?:\.\d+)?)/i,
      /事件\s*(\d+)/,
    ],
    urlPatterns: [
      /Case[_\s]?(\d+)/i,
      /File[_\s]?(\d+)/i,
    ],
    categoryPatterns: [
      /Category:Cases/i,
      /Category:Files/i,
    ],
  },
  {
    name: 'round',
    displayName: 'Round',
    patterns: [
      /Round\s*(\d+(?:\.\d+)?)/i,
      /Match\s*(\d+(?:\.\d+)?)/i,
      /Bout\s*(\d+(?:\.\d+)?)/i,
      /ラウンド\s*(\d+)/,
    ],
    urlPatterns: [
      /Round[_\s]?(\d+)/i,
      /Match[_\s]?(\d+)/i,
    ],
    categoryPatterns: [
      /Category:Rounds/i,
      /Category:Matches/i,
    ],
  },
  {
    name: 'night',
    displayName: 'Night',
    patterns: [
      /Night\s*(\d+(?:\.\d+)?)/i,
      /夜\s*(\d+)/,
    ],
    urlPatterns: [
      /Night[_\s]?(\d+)/i,
    ],
    categoryPatterns: [
      /Category:Nights/i,
    ],
  },
  {
    name: 'act',
    displayName: 'Act',
    patterns: [
      /Act\s*(\d+(?:\.\d+)?)/i,
      /Scene\s*(\d+(?:\.\d+)?)/i,
      /幕\s*(\d+)/,
    ],
    urlPatterns: [
      /Act[_\s]?(\d+)/i,
      /Scene[_\s]?(\d+)/i,
    ],
    categoryPatterns: [
      /Category:Acts/i,
      /Category:Scenes/i,
    ],
  },
  {
    name: 'track',
    displayName: 'Track',
    patterns: [
      /Track\s*(\d+(?:\.\d+)?)/i,
      /トラック\s*(\d+)/,
    ],
    urlPatterns: [
      /Track[_\s]?(\d+)/i,
    ],
    categoryPatterns: [
      /Category:Tracks/i,
    ],
  },
  {
    name: 'lesson',
    displayName: 'Lesson',
    patterns: [
      /Lesson\s*(\d+(?:\.\d+)?)/i,
      /レッスン\s*(\d+)/,
    ],
    urlPatterns: [
      /Lesson[_\s]?(\d+)/i,
    ],
    categoryPatterns: [
      /Category:Lessons/i,
    ],
  },
  {
    name: 'log',
    displayName: 'Log',
    patterns: [
      /Log\s*(\d+(?:\.\d+)?)/i,
      /Record\s*(\d+(?:\.\d+)?)/i,
      /Entry\s*(\d+(?:\.\d+)?)/i,
    ],
    urlPatterns: [
      /Log[_\s]?(\d+)/i,
      /Record[_\s]?(\d+)/i,
    ],
    categoryPatterns: [
      /Category:Logs/i,
      /Category:Records/i,
    ],
  },
  {
    name: 'tale',
    displayName: 'Tale',
    patterns: [
      /Tale\s*(\d+(?:\.\d+)?)/i,
      /Story\s*(\d+(?:\.\d+)?)/i,
    ],
    urlPatterns: [
      /Tale[_\s]?(\d+)/i,
    ],
    categoryPatterns: [
      /Category:Tales/i,
    ],
  },
  {
    name: 'curse',
    displayName: 'Curse',
    patterns: [
      /(?<!\w\s)Curse\s*(\d+(?:\.\d+)?)/i,
      /(?<!\w\s)Spell\s*(\d+(?:\.\d+)?)/i,
    ],
    urlPatterns: [
      /(?<!Bonus_)Curse[_\s]?(\d+)/i,
      /(?<!Bonus_)Spell[_\s]?(\d+)/i,
    ],
    categoryPatterns: [
      /Category:Curses/i,
      /Category:Spells/i,
    ],
  },
  {
    // Erased (Boku dake ga Inai Machi) uses "01. Title" format
    // URL: /wiki/01._Flashback:_May_2006
    // Text: 01. Flashback: May 2006
    name: 'numberedTitle',
    displayName: 'NumberedTitle',
    patterns: [
      /^(\d{2})\.\s+.+/i, // Matches "01. Title"
      /^(\d{1,2})\.\s*.+/i, // More permissive: "1. Title" or "01. Title"
    ],
    urlPatterns: [
      /\/wiki\/(\d{2})\._/, // Matches /wiki/01._Title
      /\/(\d{2})\._[A-Z]/i, // Matches /01._Flashback
    ],
    categoryPatterns: [
      /Category:Chapters/i, // Uses standard chapters category
    ],
  },
];

/**
 * Standard chapter convention (fallback).
 */
export const CHAPTER_CONVENTION: NamingConvention = {
  name: 'chapter',
  displayName: 'Chapter',
  patterns: [
    /Chapter\s*(\d+(?:\.\d+)?)/i,
    /Ch\.?\s*(\d+(?:\.\d+)?)/i,
    /第(\d+)章/,
    /第(\d+)回/,
    /#(\d+(?:\.\d+)?)/,
  ],
  urlPatterns: [
    /Chapter[_\s]?(\d+)/i,
    /Ch[_\s]?(\d+)/i,
  ],
  categoryPatterns: [
    /Category:Chapters/i,
  ],
};

/**
 * Creates a combined regex that matches any of the naming conventions.
 * Useful for extracting chapter numbers regardless of convention.
 */
export function createUniversalChapterRegex(): RegExp {
  const allPatterns: string[] = [];

  // Add all convention patterns
  for (const convention of NAMING_CONVENTIONS) {
    for (const pattern of convention.patterns) {
      allPatterns.push(pattern.source);
    }
  }

  // Add chapter patterns
  for (const pattern of CHAPTER_CONVENTION.patterns) {
    allPatterns.push(pattern.source);
  }

  // Combine with OR
  return new RegExp(`(?:${allPatterns.join('|')})`, 'i');
}

/**
 * Extracts chapter number from text using provided convention or tries all.
 * This is a pure utility function without HTML parsing dependencies.
 */
export function extractChapterNumberFromText(
  text: string,
  convention?: NamingConvention | null
): number | null {
  // Use provided convention or try all conventions
  const conventions = convention
    ? [convention, CHAPTER_CONVENTION]
    : [CHAPTER_CONVENTION, ...NAMING_CONVENTIONS];

  for (const conv of conventions) {
    for (const pattern of conv.patterns) {
      const match = text.match(pattern);
      if (match?.[1]) {
        return parseFloat(match[1]);
      }
    }
  }

  // Fallback: try bare number
  const bareNumber = text.match(/^(\d+(?:\.\d+)?)$/);
  if (bareNumber?.[1]) {
    return parseFloat(bareNumber[1]);
  }

  return null;
}

/**
 * Cleans chapter title by removing the convention prefix.
 */
export function cleanChapterTitle(title: string, convention?: NamingConvention | null): string {
  let cleaned = title;

  // Special handling for numberedTitle format (e.g., "01. Flashback: May 2006")
  const numberedTitleMatch = cleaned.match(/^(\d{1,2})\.\s*(.+)$/);
  if (numberedTitleMatch?.[2]) {
    return numberedTitleMatch[2].trim();
  }

  // Remove patterns from all conventions
  const conventions = convention
    ? [convention, CHAPTER_CONVENTION]
    : [CHAPTER_CONVENTION, ...NAMING_CONVENTIONS];

  for (const conv of conventions) {
    for (const pattern of conv.patterns) {
      // Create replacement pattern that includes optional separators
      const source = pattern.source;
      const replacePattern = new RegExp(`^${source}[:\\s-]*`, 'i');
      cleaned = cleaned.replace(replacePattern, '');
    }
  }

  return cleaned.trim();
}

/**
 * Gets all naming convention names for logging/debugging.
 */
export function getAllConventionNames(): string[] {
  return [
    CHAPTER_CONVENTION.displayName,
    ...NAMING_CONVENTIONS.map(c => c.displayName),
  ];
}
