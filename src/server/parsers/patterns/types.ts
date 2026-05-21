/**
 * Pattern Library Type Definitions
 *
 * Shared type definitions and interfaces for all pattern matching modules.
 * These types form the foundation for the pattern extraction system.
 *
 * Extracted from: PatternLibrary.ts (lines 8-34, 596-601)
 */

/**
 * Represents a successful pattern match result
 *
 * @property type - The type of pattern matched (e.g., 'volume', 'chapter', 'year')
 * @property value - The extracted value from the match (string or number)
 * @property confidence - Confidence score for the match (0-1)
 * @property pattern - The pattern string that produced the match
 * @property context - Optional contextual information about the match
 */
export interface PatternMatch {
  type: string;
  value: string | number;
  confidence: number;
  pattern: string;
  context?: string;
}

/**
 * Collection of related patterns for a specific type
 *
 * Organizes patterns by priority and characteristics for efficient matching.
 *
 * @property primary - High-priority patterns tried first
 * @property contextual - Patterns requiring contextual information
 * @property special - Special case patterns for edge cases
 * @property negative - Patterns to explicitly reject/exclude
 * @property validators - Functions to validate and transform matches
 */
export interface PatternCollection {
  primary?: RegExp[];
  contextual?: ContextualPattern[];
  special?: RegExp[];
  negative?: RegExp[];
  validators?: PatternValidator[];
}

/**
 * Pattern that requires contextual information
 *
 * Used for patterns that need additional context to determine validity,
 * such as volume patterns that should only match near certain keywords.
 *
 * @property pattern - The regular expression pattern
 * @property requiresContext - Array of required context keywords
 * @property confidence - Confidence score when context is present (0-1)
 */
export interface ContextualPattern {
  pattern: RegExp;
  requiresContext: string[];
  confidence: number;
}

/**
 * Validator for pattern matches with optional transformation
 *
 * Provides validation and transformation capabilities for pattern matches,
 * allowing for complex validation logic and value normalization.
 *
 * @property validate - Function to validate a matched value
 * @property transform - Optional function to transform/normalize the value
 */
export interface PatternValidator {
  validate: (value: string) => boolean;
  transform?: (value: string) => string;
}

/**
 * Options for pattern matching operations
 *
 * Configures behavior of pattern matching functions, allowing for
 * customization of cleaning, context checking, and special pattern inclusion.
 *
 * @property clean - Whether to clean/normalize input before matching
 * @property checkContext - Whether to check contextual patterns
 * @property includeSpecial - Whether to include special case patterns
 * @property context - Additional context string for contextual matching
 */
export interface MatchOptions {
  clean?: boolean;
  checkContext?: boolean;
  includeSpecial?: boolean;
  context?: string;
}
