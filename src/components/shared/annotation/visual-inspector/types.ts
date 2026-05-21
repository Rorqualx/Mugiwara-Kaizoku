/**
 * Visual Inspector Types
 *
 * Type definitions for the visual inspector feature including
 * extraction types, selector types, and validation results.
 *
 * @module components/shared/annotation/visual-inspector/types
 */

// ============================================================================
// Selector Types
// ============================================================================

/**
 * Type of extraction to perform on matched elements
 */
export type ExtractionType = 'text' | 'attribute' | 'html';

/**
 * Type of selector syntax
 */
export type SelectorType = 'css' | 'xpath';

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Configuration for how to extract content from matched elements
 */
export interface ExtractionConfig {
  /** Type of extraction to perform */
  type: ExtractionType;
  /** Attribute name to extract (required when type is 'attribute') */
  attribute?: string;
}

// ============================================================================
// Validation Types
// ============================================================================

/**
 * Result of validating a selector against a webpage
 */
export interface SelectorValidationResult {
  /** Whether the selector is valid and matches at least one element */
  isValid: boolean;
  /** Number of elements matched by the selector */
  matchCount: number;
  /** Sample extracted values from matched elements (max 5) */
  samples: string[];
  /** Non-blocking warnings about selector quality or performance */
  warnings: string[];
  /** Suggestions for improving the selector */
  suggestions: string[];
  /** Security issues that would block usage */
  safetyIssues: string[];
}

/**
 * Default empty validation result
 */
export const EMPTY_VALIDATION_RESULT: SelectorValidationResult = {
  isValid: false,
  matchCount: 0,
  samples: [],
  warnings: [],
  suggestions: [],
  safetyIssues: []
};

// ============================================================================
// State Types
// ============================================================================

/**
 * Enhanced state for selector management with validation
 */
export interface EnhancedSelectorState {
  /** The selector string (CSS or XPath) */
  selector: string;
  /** Type of selector syntax */
  selectorType: SelectorType;
  /** Extraction configuration */
  extraction: ExtractionConfig;
  /** Current validation result (null if not yet validated) */
  validationResult: SelectorValidationResult | null;
  /** Whether validation is in progress */
  isValidating: boolean;
}

/**
 * Default state for enhanced selector
 */
export const DEFAULT_ENHANCED_SELECTOR_STATE: EnhancedSelectorState = {
  selector: '',
  selectorType: 'css',
  extraction: { type: 'text' },
  validationResult: null,
  isValidating: false
};

// ============================================================================
// Hook Return Types
// ============================================================================

/**
 * Return type for useSelectorValidation hook
 */
export interface UseSelectorValidationResult {
  /** The validation result data */
  data: SelectorValidationResult | null;
  /** Whether the query is pending */
  isPending: boolean;
  /** Whether the query encountered an error */
  isError: boolean;
  /** Error message if any */
  error: string | null;
  /** Force refetch the validation */
  refetch: () => void;
}

// ============================================================================
// Component Props Types
// ============================================================================

/**
 * Props for ExtractionTypePanel component
 */
export interface ExtractionTypePanelProps {
  /** Current extraction type */
  extractType: ExtractionType;
  /** Current attribute name (for attribute extraction) */
  attribute: string;
  /** Callback when extraction type changes */
  onExtractionTypeChange: (type: ExtractionType) => void;
  /** Callback when attribute name changes */
  onAttributeChange: (attr: string) => void;
}

/**
 * Props for SelectorTypeToggle component
 */
export interface SelectorTypeToggleProps {
  /** Current selector type */
  value: SelectorType;
  /** Callback when selector type changes */
  onChange: (type: SelectorType) => void;
}

/**
 * Props for LivePreviewPanel component
 */
export interface LivePreviewPanelProps {
  /** Current validation result */
  validationResult: SelectorValidationResult | null;
  /** Whether validation is in progress */
  isPending: boolean;
}

/**
 * Props for ValidationFeedbackPanel component
 */
export interface ValidationFeedbackPanelProps {
  /** Non-blocking warnings */
  warnings: string[];
  /** Improvement suggestions */
  suggestions: string[];
  /** Security issues */
  safetyIssues: string[];
}
