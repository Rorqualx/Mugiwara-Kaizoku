/**
 * Wikipedia Parser Configuration
 *
 * Centralized configuration for Wikipedia HTML parsing.
 * Extracts all magic numbers and hardcoded values for maintainability.
 */

/**
 * Parser configuration options
 */
export interface WikipediaParserConfig {
  /** Chapter-related limits */
  chapters: {
    /** Maximum chapter number to handle (default: 2000 for One Piece) */
    maxChapterNumber: number;
    /** Average chapters per volume for estimation fallback */
    avgChaptersPerVolume: number;
    /** Maximum rows per volume section to parse */
    maxRowsPerVolume: number;
  };

  /** Text length thresholds */
  textLimits: {
    /** Minimum description length to be valid */
    minDescriptionLength: number;
    /** Maximum description length to accept */
    maxDescriptionLength: number;
    /** Minimum title length */
    minTitleLength: number;
    /** Maximum title length */
    maxTitleLength: number;
    /** Minimum summary length */
    minSummaryLength: number;
  };

  /** HTML structure patterns */
  patterns: {
    /** Volume ID attribute pattern (e.g., "vol" for id="vol1") */
    volumeIdPrefix: string;
    /** Minimum colspan for summary cells */
    summaryColspanMin: number;
    /** Number of header rows to skip */
    headerRowCount: number;
  };
}

/**
 * Default Wikipedia parser configuration
 *
 * These values are tuned for general manga Wikipedia pages.
 * Individual parsers may override specific values.
 */
export const DEFAULT_PARSER_CONFIG: WikipediaParserConfig = {
  chapters: {
    // One Piece has 1100+ chapters, so we need headroom
    maxChapterNumber: 2000,
    // Most manga average 8-10 chapters per volume
    avgChaptersPerVolume: 9,
    // Volume sections rarely have more than 15 rows
    maxRowsPerVolume: 20,
  },

  textLimits: {
    // Short descriptions can be valid (30 chars is ~5 words)
    minDescriptionLength: 30,
    // Long descriptions are usually valid; truncate at display, not parse
    maxDescriptionLength: 10000,
    // Single character titles exist (rare)
    minTitleLength: 1,
    // Some titles with Japanese can be long
    maxTitleLength: 200,
    // Summaries should be at least a sentence
    minSummaryLength: 30,
  },

  patterns: {
    // Standard Wikipedia volume ID pattern
    volumeIdPrefix: 'vol',
    // Summary cells typically span 3+ columns
    summaryColspanMin: 3,
    // Most tables have 1 header row
    headerRowCount: 1,
  },
};

/**
 * Get parser config with optional overrides
 *
 * @param overrides - Partial config to override defaults
 * @returns Merged config
 */
export function getParserConfig(
  overrides?: Partial<WikipediaParserConfig>
): WikipediaParserConfig {
  if (!overrides) {
    return DEFAULT_PARSER_CONFIG;
  }

  return {
    chapters: {
      ...DEFAULT_PARSER_CONFIG.chapters,
      ...overrides.chapters,
    },
    textLimits: {
      ...DEFAULT_PARSER_CONFIG.textLimits,
      ...overrides.textLimits,
    },
    patterns: {
      ...DEFAULT_PARSER_CONFIG.patterns,
      ...overrides.patterns,
    },
  };
}

/**
 * Volume ID regex pattern generator
 *
 * @param prefix - Volume ID prefix (default: "vol")
 * @returns Regex pattern for matching volume IDs
 */
export function getVolumeIdPattern(prefix = 'vol'): RegExp {
  return new RegExp(`id="${prefix}(\\d+)"`, 'g');
}

/**
 * Volume section pattern generator
 *
 * @param volumeNumber - Volume number to match
 * @param maxRows - Maximum rows to capture
 * @param prefix - Volume ID prefix
 * @returns Regex pattern for matching volume section content
 */
export function getVolumeSectionPattern(
  volumeNumber: number,
  maxRows = DEFAULT_PARSER_CONFIG.chapters.maxRowsPerVolume,
  prefix = 'vol'
): RegExp {
  return new RegExp(
    `id="${prefix}${volumeNumber}".*?(<tr.*?</tr>.*?){1,${maxRows}}`,
    's'
  );
}

/**
 * Check if text meets description length requirements
 */
export function isValidDescription(
  text: string,
  config = DEFAULT_PARSER_CONFIG
): boolean {
  const length = text.trim().length;
  return (
    length >= config.textLimits.minDescriptionLength &&
    length <= config.textLimits.maxDescriptionLength
  );
}

/**
 * Check if text meets title length requirements
 */
export function isValidTitle(
  text: string,
  config = DEFAULT_PARSER_CONFIG
): boolean {
  const length = text.trim().length;
  return (
    length >= config.textLimits.minTitleLength &&
    length <= config.textLimits.maxTitleLength
  );
}

/**
 * Check if colspan meets summary cell requirement
 */
export function isSummaryCell(
  colspan: number,
  config = DEFAULT_PARSER_CONFIG
): boolean {
  return colspan >= config.patterns.summaryColspanMin;
}
