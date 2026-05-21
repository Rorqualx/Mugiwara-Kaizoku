/**
 * Offset Mapper for Whitespace Normalization
 *
 * Tracks how character positions change when whitespace is normalized.
 * Used to update selection offsets after DOM normalization.
 */

/**
 * A mapping entry tracking original position to normalized position
 */
interface OffsetMapping {
  /** Original character position in the source text */
  original: number;
  /** New character position after normalization */
  normalized: number;
  /** Cumulative offset change at this point */
  delta: number;
}

/**
 * Result from processing a single character during normalization
 */
interface CharProcessResult {
  normalizedPos: number;
  cumulativeDelta: number;
  char: string;
  inWhitespace: boolean;
}

/**
 * Result of offset mapping operation
 */
export interface OffsetMapResult {
  /** The normalized text */
  normalizedText: string;
  /** Whether any normalization occurred */
  wasNormalized: boolean;
  /** Translate an original offset to its normalized position */
  translateOffset: (originalOffset: number) => number;
  /** Translate a normalized offset back to original position */
  reverseTranslate: (normalizedOffset: number) => number;
}

/**
 * Process a whitespace character in the normalization mapping
 */
function processWhitespaceChar(
  mappings: OffsetMapping[],
  index: number,
  normalizedPos: number,
  cumulativeDelta: number,
  inWhitespace: boolean
): CharProcessResult {
  if (!inWhitespace) {
    // First whitespace in a run - keep it as a single space
    mappings.push({ original: index, normalized: normalizedPos, delta: cumulativeDelta });
    return { normalizedPos: normalizedPos + 1, cumulativeDelta, char: ' ', inWhitespace: true };
  }
  // Additional whitespace - skip it, track the delta
  const newDelta = cumulativeDelta + 1;
  mappings.push({ original: index, normalized: normalizedPos - 1, delta: newDelta });
  return { normalizedPos, cumulativeDelta: newDelta, char: '', inWhitespace: true };
}

/**
 * Process a non-whitespace character in the normalization mapping
 */
function processNonWhitespaceChar(
  mappings: OffsetMapping[],
  char: string,
  index: number,
  normalizedPos: number,
  cumulativeDelta: number
): CharProcessResult {
  mappings.push({ original: index, normalized: normalizedPos, delta: cumulativeDelta });
  return { normalizedPos: normalizedPos + 1, cumulativeDelta, char, inWhitespace: false };
}

/**
 * Create an offset mapper for whitespace normalization
 *
 * This tracks exactly how positions shift when multiple whitespace
 * characters are collapsed to a single space.
 *
 * @param originalText - The original text before normalization
 * @returns Offset map result with translation functions
 */
export function createWhitespaceOffsetMap(originalText: string): OffsetMapResult {
  const mappings: OffsetMapping[] = [];
  let normalizedText = '';
  let normalizedPos = 0;
  let cumulativeDelta = 0;
  let inWhitespace = false;

  for (let i = 0; i < originalText.length; i++) {
    const char = originalText[i] ?? '';
    const isWhitespace = /\s/.test(char);

    const result: CharProcessResult = isWhitespace
      ? processWhitespaceChar(mappings, i, normalizedPos, cumulativeDelta, inWhitespace)
      : processNonWhitespaceChar(mappings, char, i, normalizedPos, cumulativeDelta);

    normalizedPos = result.normalizedPos;
    cumulativeDelta = result.cumulativeDelta;
    inWhitespace = result.inWhitespace;
    normalizedText += result.char;
  }

  const wasNormalized = normalizedText !== originalText;

  return {
    normalizedText,
    wasNormalized,
    translateOffset: (originalOffset: number) =>
      translateOriginalToNormalized(mappings, originalOffset),
    reverseTranslate: (normalizedOffset: number) =>
      translateNormalizedToOriginal(mappings, normalizedOffset),
  };
}

/**
 * Translate an original offset to its normalized position
 */
function translateOriginalToNormalized(
  mappings: OffsetMapping[],
  originalOffset: number
): number {
  if (mappings.length === 0) return originalOffset;

  // Handle offset beyond text
  const lastMapping = mappings[mappings.length - 1];
  if (!lastMapping) return originalOffset;
  if (originalOffset >= mappings.length) {
    return lastMapping.normalized + (originalOffset - lastMapping.original);
  }

  // Find the mapping entry for this position
  const mapping = mappings[originalOffset];
  return mapping?.normalized ?? originalOffset;
}

/**
 * Translate a normalized offset back to original position
 */
function translateNormalizedToOriginal(
  mappings: OffsetMapping[],
  normalizedOffset: number
): number {
  if (mappings.length === 0) return normalizedOffset;

  // Find the first mapping with this normalized position
  for (const mapping of mappings) {
    if (mapping.normalized === normalizedOffset) {
      return mapping.original;
    }
  }

  // Handle offset beyond text
  const lastMapping = mappings[mappings.length - 1];
  if (!lastMapping) return normalizedOffset;
  return lastMapping.original + (normalizedOffset - lastMapping.normalized);
}

/**
 * Batch translate multiple offsets
 *
 * @param originalText - The original text
 * @param offsets - Array of [start, end] offset pairs to translate
 * @returns Array of translated [start, end] pairs and the normalized text
 */
export function translateOffsetsAfterNormalization(
  originalText: string,
  offsets: Array<{ start: number; end: number }>
): {
  normalizedText: string;
  translatedOffsets: Array<{ start: number; end: number }>;
  wasNormalized: boolean;
} {
  const mapper = createWhitespaceOffsetMap(originalText);

  const translatedOffsets = offsets.map(({ start, end }) => ({
    start: mapper.translateOffset(start),
    end: mapper.translateOffset(end),
  }));

  return {
    normalizedText: mapper.normalizedText,
    translatedOffsets,
    wasNormalized: mapper.wasNormalized,
  };
}

/**
 * Validate that text content matches at given offsets
 *
 * @param text - The text to check
 * @param start - Start offset
 * @param end - End offset
 * @param expectedText - Expected text at this range
 * @returns Whether the text matches
 */
export function validateTextAtOffset(
  text: string,
  start: number,
  end: number,
  expectedText: string
): boolean {
  if (start < 0 || end > text.length || start >= end) {
    return false;
  }
  return text.substring(start, end) === expectedText;
}

/**
 * Find the new offsets for text after normalization using content matching
 *
 * This is a fallback when offset mapping fails - it searches for the
 * expected text in the normalized content.
 *
 * @param normalizedText - The normalized text
 * @param expectedText - The text we're looking for
 * @param nearOffset - Approximate position to search near
 * @returns New offsets or null if not found
 */
export function findTextInNormalized(
  normalizedText: string,
  expectedText: string,
  nearOffset: number
): { start: number; end: number } | null {
  if (!expectedText) return null;

  // First try exact match at nearby position
  const searchStart = Math.max(0, nearOffset - 50);
  const searchEnd = Math.min(normalizedText.length, nearOffset + 50 + expectedText.length);
  const searchRegion = normalizedText.substring(searchStart, searchEnd);

  const localIndex = searchRegion.indexOf(expectedText);
  if (localIndex !== -1) {
    const globalStart = searchStart + localIndex;
    return { start: globalStart, end: globalStart + expectedText.length };
  }

  // Fall back to global search
  const globalIndex = normalizedText.indexOf(expectedText);
  if (globalIndex !== -1) {
    return { start: globalIndex, end: globalIndex + expectedText.length };
  }

  return null;
}
