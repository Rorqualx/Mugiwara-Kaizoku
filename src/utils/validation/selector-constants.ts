/**
 * Shared Selector Security Constants
 *
 * This module exports security-related constants for selector validation.
 * These constants are shared across the codebase to ensure consistent
 * security checks and avoid duplication.
 *
 * @module SelectorConstants
 * @category Validation
 * @subcategory Selectors
 */

// ============================================================================
// Security Constants
// ============================================================================

/**
 * Dangerous patterns that are not allowed in CSS selectors.
 * Used for security validation across the codebase.
 *
 * These patterns detect potential XSS and injection attacks:
 * - JavaScript/VBScript URLs
 * - Event handlers (onclick, onload, etc.)
 * - Script/iframe injection
 * - CSS expression injection
 */
export const DANGEROUS_SELECTOR_PATTERNS = [
  { pattern: /javascript:/i, error: 'JavaScript URLs are not allowed' },
  { pattern: /data:/i, error: 'Data URLs are not allowed' },
  { pattern: /vbscript:/i, error: 'VBScript URLs are not allowed' },
  { pattern: /on\w+\s*=/i, error: 'Event handlers are not allowed' },
  { pattern: /<script/i, error: 'Script tags are not allowed' },
  { pattern: /<iframe/i, error: 'Iframe tags are not allowed' },
  { pattern: /expression\s*\(/i, error: 'CSS expressions are not allowed' }
] as const;

/**
 * Type for dangerous pattern entries
 */
export type DangerousSelectorPattern = (typeof DANGEROUS_SELECTOR_PATTERNS)[number];

/**
 * Valid CSS selector character pattern.
 * Allows letters, numbers, common selector characters and combinators.
 *
 * Allowed characters:
 * - a-z, A-Z (letters)
 * - 0-9 (numbers)
 * - - _ (hyphen, underscore)
 * - [ ] = (attribute selectors)
 * - : (pseudo-classes/elements)
 * - . # (class and ID selectors)
 * - > + ~ | (combinators)
 * - , * (grouping, universal)
 * - spaces (descendant combinator)
 */
export const CSS_SELECTOR_PATTERN = /^[a-zA-Z0-9\-_[\]=:\s.#>+~|,*]+$/;

/**
 * Helper to extract just the RegExp patterns from DANGEROUS_SELECTOR_PATTERNS
 */
export function getDangerousPatternRegexps(): RegExp[] {
  return DANGEROUS_SELECTOR_PATTERNS.map(p => p.pattern);
}

/**
 * Check if a string contains any dangerous patterns
 */
export function hasDangerousPattern(value: string): { hasDanger: boolean; error?: string } {
  for (const { pattern, error } of DANGEROUS_SELECTOR_PATTERNS) {
    if (pattern.test(value)) {
      return { hasDanger: true, error };
    }
  }
  return { hasDanger: false };
}
