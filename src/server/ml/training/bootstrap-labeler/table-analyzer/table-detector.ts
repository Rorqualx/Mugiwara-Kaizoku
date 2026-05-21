/**
 * Table Type Detection
 *
 * Determines if a table contains chapter list, volume list, etc.
 */

export type TableType = 'chapter_list' | 'volume_list' | 'character_list' | 'unknown';

export interface TableTypeResult {
  type: TableType;
  confidence: number;
}

interface TableTypeIndicators {
  headerPatterns: RegExp[];
  contextPatterns: RegExp[];
  minConfidence: number;
}

const TABLE_TYPE_INDICATORS: Record<TableType, TableTypeIndicators> = {
  chapter_list: {
    headerPatterns: [/chapter/i, /episode/i, /ch\.?\s*\d/i, /^#$/],
    contextPatterns: [/#Chapters/i, /Chapter_list/i, /Episode_list/i, /ChapterList/i],
    minConfidence: 0.7,
  },
  volume_list: {
    // Match "Volume", "Vol. 1", "Tankōbon", but also Wikipedia patterns:
    // "No.", "#", "ISBN", "release date" (Wikipedia volume tables)
    headerPatterns: [
      /volume/i,
      /vol\.?\s*\d/i,
      /tankōbon/i,
      /tankoubon/i,
      /^no\.?$/i,      // Wikipedia: "No." or "No"
      /^#$/,            // Wikipedia: "#" column
      /isbn/i,          // Wikipedia: "Original ISBN", "English ISBN"
      /release.*date/i, // Wikipedia: "Original release date"
    ],
    contextPatterns: [/#Volumes/i, /Volume_list/i, /Tankōbon/i, /VolumeList/i],
    minConfidence: 0.7,
  },
  character_list: {
    headerPatterns: [/character/i, /^name$/i, /role/i, /cast/i],
    contextPatterns: [/#Characters/i, /Character_list/i, /CharacterList/i],
    minConfidence: 0.6,
  },
  unknown: {
    headerPatterns: [],
    contextPatterns: [],
    minConfidence: 0,
  },
};

/**
 * Check if a header matches any of the patterns
 */
function headerMatchesPatterns(header: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(header));
}

/**
 * Count matching headers for a set of patterns
 */
function countMatchingHeaders(headers: string[], patterns: RegExp[]): number {
  let count = 0;
  for (const header of headers) {
    if (headerMatchesPatterns(header, patterns)) {
      count++;
    }
  }
  return count;
}

/**
 * Detect table type from header texts
 */
export function detectTableTypeFromHeaders(headers: string[]): TableTypeResult {
  const normalizedHeaders = headers.map((h) => h.toLowerCase().trim());

  let bestMatch: TableTypeResult = { type: 'unknown', confidence: 0 };

  for (const [type, indicators] of Object.entries(TABLE_TYPE_INDICATORS)) {
    if (type === 'unknown') continue;

    const matchCount = countMatchingHeaders(normalizedHeaders, indicators.headerPatterns);

    if (matchCount > 0) {
      const confidence = Math.min(0.95, 0.5 + matchCount * 0.15);
      if (confidence > bestMatch.confidence) {
        bestMatch = { type: type as TableType, confidence };
      }
    }
  }

  return bestMatch;
}

/**
 * Detect table type from surrounding context (xpath, nearby text)
 */
export function detectTableTypeFromContext(
  xpath: string,
  nearbyText: string
): TableTypeResult {
  const context = `${xpath} ${nearbyText}`.toLowerCase();

  for (const [type, indicators] of Object.entries(TABLE_TYPE_INDICATORS)) {
    if (type === 'unknown') continue;

    const hasMatch = indicators.contextPatterns.some((pattern) => pattern.test(context));
    if (hasMatch) {
      return { type: type as TableType, confidence: 0.85 };
    }
  }

  return { type: 'unknown', confidence: 0 };
}

/**
 * Combined table type detection using both headers and context
 */
export function detectTableType(
  headers: string[],
  xpath: string,
  nearbyText: string = ''
): TableTypeResult {
  const headerResult = detectTableTypeFromHeaders(headers);
  const contextResult = detectTableTypeFromContext(xpath, nearbyText);

  // If both agree, boost confidence
  if (headerResult.type === contextResult.type && headerResult.type !== 'unknown') {
    return {
      type: headerResult.type,
      confidence: Math.min(1.0, headerResult.confidence + 0.1),
    };
  }

  // Return the higher confidence result
  if (headerResult.confidence >= contextResult.confidence) {
    return headerResult;
  }
  return contextResult;
}

/**
 * Check if a set of headers suggests this is a data table (not layout)
 */
export function isDataTable(headers: string[]): boolean {
  if (headers.length < 2) return false;

  const dataPatterns = [
    /^#$/,
    /title/i,
    /name/i,
    /date/i,
    /chapter/i,
    /volume/i,
    /pages/i,
    /release/i,
  ];

  const dataColumnCount = countMatchingHeaders(headers, dataPatterns);
  return dataColumnCount >= 2;
}
