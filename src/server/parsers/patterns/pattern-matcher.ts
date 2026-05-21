/**
 * Pattern Matching Functions
 *
 * Focused pattern matching logic extracted from PatternLibrary
 * to reduce complexity and improve maintainability.
 *
 * Each matcher function targets a specific priority level:
 * - Primary patterns: Highest priority, exact matches
 * - Contextual patterns: Requires context keywords
 * - Special patterns: Edge cases and special formats
 *
 * Extracted from: PatternLibrary.ts (lines 414-486)
 * Target: Reduce match() complexity from 37 to <15 per function
 */

import type { PatternMatch, PatternCollection, MatchOptions } from './types';

/**
 * Match primary patterns (highest priority)
 *
 * Primary patterns are tried first and have the highest confidence (1.0).
 * They represent exact, unambiguous matches like "Volume 5" or "Chapter 10".
 *
 * @param text - Text to match against
 * @param collection - Pattern collection containing primary patterns
 * @param patternType - Type identifier for the match result
 * @param options - Optional matching options
 * @returns Pattern match or null if no match found
 *
 * Complexity target: <14
 * Max nesting: 3
 */
export function matchPrimaryPatterns(
  text: string,
  collection: PatternCollection,
  patternType: string,
  options?: MatchOptions
): PatternMatch | null {
  if (!collection.primary) return null;

  for (const pattern of collection.primary) {
    const match = text.match(pattern);
    if (!match) continue;

    const value = match[1] ?? match[0];

    // Validate if validators exist
    if (!validatePatternMatch(value, collection.validators)) {
      continue;
    }

    // Check negative patterns
    if (checkNegativePatterns(text, collection.negative)) {
      continue;
    }

    const result: PatternMatch = {
      type: patternType,
      value: collection.validators?.[0]?.transform?.(value) ?? value,
      confidence: 1.0,
      pattern: pattern.source
    };

    if (options?.context) {
      result.context = options.context;
    }

    return result;
  }

  return null;
}

/**
 * Match contextual patterns (requires context keywords)
 *
 * Contextual patterns require certain keywords to be present in the text
 * before matching. This prevents false positives from ambiguous patterns.
 * For example, matching "5" only when "volume" or "vol" appears nearby.
 *
 * @param text - Text to match against
 * @param collection - Pattern collection containing contextual patterns
 * @param patternType - Type identifier for the match result
 * @param options - Optional matching options
 * @returns Pattern match or null if no match found
 *
 * Complexity target: <12
 * Max nesting: 3
 */
export function matchContextualPatterns(
  text: string,
  collection: PatternCollection,
  patternType: string,
  options?: MatchOptions
): PatternMatch | null {
  if (!collection.contextual || options?.checkContext === false) {
    return null;
  }

  for (const contextual of collection.contextual) {
    if (!hasRequiredContext(text, contextual.requiresContext)) {
      continue;
    }

    const match = text.match(contextual.pattern);
    if (!match) continue;

    const value = match[1] ?? match[0];

    // Validate
    if (!validatePatternMatch(value, collection.validators)) {
      continue;
    }

    return {
      type: patternType,
      value: collection.validators?.[0]?.transform?.(value) ?? value,
      confidence: contextual.confidence,
      pattern: contextual.pattern.source,
      context: contextual.requiresContext.join(',')
    };
  }

  return null;
}

/**
 * Match special patterns (lowest priority)
 *
 * Special patterns handle edge cases and unusual formats that don't fit
 * the standard patterns. They have lower confidence and are only checked
 * when explicitly requested via options.includeSpecial.
 *
 * Examples: "Volume 0", "One-Shot", "Omnibus Edition"
 *
 * @param text - Text to match against
 * @param collection - Pattern collection containing special patterns
 * @param patternType - Type identifier for the match result
 * @returns Pattern match or null if no match found
 *
 * Complexity target: <8
 * Max nesting: 2
 */
export function matchSpecialPatterns(
  text: string,
  collection: PatternCollection,
  patternType: string
): PatternMatch | null {
  if (!collection.special) return null;

  for (const pattern of collection.special) {
    const match = text.match(pattern);
    if (match) {
      return {
        type: patternType,
        value: match[0], // Return full match for special patterns
        confidence: 0.8,
        pattern: pattern.source,
        context: 'special'
      };
    }
  }

  return null;
}

/**
 * Validate pattern match against validators
 *
 * Runs all validators in the collection against the matched value.
 * Returns true if all validators pass or if no validators exist.
 *
 * @param value - Matched value to validate
 * @param validators - Optional array of validators to run
 * @returns True if valid or no validators exist
 *
 * Complexity target: <5
 */
function validatePatternMatch(
  value: string,
  validators?: Array<{ validate: (value: string) => boolean }>
): boolean {
  if (!validators) return true;
  return validators.every(v => v.validate(value));
}

/**
 * Check if text matches negative patterns
 *
 * Negative patterns are used to explicitly reject certain matches.
 * For example, excluding "Volume 5 Extra" when looking for volume numbers.
 *
 * @param text - Text to check against negative patterns
 * @param negativePatterns - Optional array of negative patterns
 * @returns True if negative pattern found (should skip)
 *
 * Complexity target: <4
 */
function checkNegativePatterns(
  text: string,
  negativePatterns?: RegExp[]
): boolean {
  if (!negativePatterns) return false;
  return negativePatterns.some(neg => neg.test(text));
}

/**
 * Check if text contains required context keywords
 *
 * Context keywords help disambiguate patterns. For example, the pattern
 * /\d+/ could match many things, but if "volume" is present, it's more
 * likely to be a volume number.
 *
 * @param text - Text to search for context keywords
 * @param requiredContext - Array of context keywords to search for
 * @returns True if any required context is found or if no context required
 *
 * Complexity target: <4
 */
function hasRequiredContext(
  text: string,
  requiredContext: string[]
): boolean {
  if (requiredContext.length === 0) return true;

  const lowerText = text.toLowerCase();
  return requiredContext.some(context =>
    lowerText.includes(context.toLowerCase())
  );
}
