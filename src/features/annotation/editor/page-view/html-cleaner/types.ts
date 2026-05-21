/**
 * HTML Cleaner Types
 *
 * Type definitions for the HTML cleaning pipeline that removes
 * unwanted UI elements (cookie banners, navigation, ads) from
 * page snapshots while preserving content for annotation.
 */

/**
 * Categories of elements that can be removed or hidden
 */
export type ElementCategory =
  | 'cookie'
  | 'navigation'
  | 'ad'
  | 'overlay'
  | 'sticky'
  | 'video'
  | 'social'
  | 'tracking';

/**
 * A signal used to identify elements for removal
 * Multiple signals are combined with weighted scoring
 */
export interface ElementSignal {
  /** CSS selector to match elements */
  selector: string;
  /** Weight for scoring (0-100, higher = more confident) */
  weight: number;
  /** Category of element this signal identifies */
  category: ElementCategory;
  /** Optional: only apply to specific element types */
  elementTypes?: string[];
}

/**
 * DOM normalization options for consistent text handling
 * Improves XPath/char offset reliability for selection reconstruction
 */
export interface NormalizationOptions {
  /** Merge adjacent text nodes using Node.normalize() */
  mergeTextNodes?: boolean;
  /** Flatten nested inline elements (<b><b>x</b></b> → <b>x</b>) */
  flattenNestedFormatting?: boolean;
  /** Collapse multiple whitespace to single space */
  normalizeWhitespace?: boolean;
  /** Remove empty text nodes */
  removeEmptyTextNodes?: boolean;
  /** Preserve whitespace inside these selectors (e.g., 'pre', 'code') */
  preserveWhitespaceIn?: string[];
}

/**
 * Provider-specific configuration for HTML cleaning
 */
export interface ProviderProfile {
  /** Provider name (e.g., 'fandom', 'wikipedia') */
  name: string;
  /** URL patterns to match this provider */
  hostPatterns: RegExp[];
  /** Selectors for main content containers (these are preserved) */
  contentSelectors: string[];
  /** Selectors for elements safe to remove entirely (outside content root only) */
  removeSelectors: string[];
  /**
   * Selectors for elements that MUST be removed even inside the content root.
   * Used to align client-side DOM with server-side tokenization (e.g., citation
   * markers that the server strips before generating selectionText/XPaths).
   * Elements matching these selectors are force-removed regardless of location.
   */
  contentRemoveSelectors?: string[];
  /** Selectors for elements that should be hidden via CSS */
  hideSelectors: string[];
  /** Selectors that should never be touched */
  preserveSelectors: string[];
  /** Additional signals for weighted scoring */
  signals?: ElementSignal[];
  /** DOM normalization options for consistent text handling */
  normalization?: NormalizationOptions;
}

/**
 * Action to take on an identified element
 */
export type ElementAction = 'remove' | 'hide' | 'keep';

/**
 * Result of analyzing an element for cleanup
 */
export interface ElementDecision {
  /** The selector that matched */
  selector: string;
  /** Action to take */
  action: ElementAction;
  /** Category of the element */
  category: ElementCategory;
  /** Confidence score (0-100) */
  score: number;
  /** Reason for the decision */
  reason: string;
}

/**
 * Options for the HTML cleaning process
 */
export interface CleanupOptions {
  /** Source URL for provider detection */
  sourceUrl?: string | undefined;
  /** Force a specific provider profile */
  forceProvider?: string | undefined;
  /** Enable aggressive removal (more elements, higher risk) */
  aggressive?: boolean | undefined;
  /** Never remove elements, only generate hide CSS */
  hideOnly?: boolean | undefined;
  /** Enable debug logging */
  debug?: boolean | undefined;
  /** Override provider's normalization settings */
  normalization?: NormalizationOptions;
  /** Skip normalization entirely */
  skipNormalization?: boolean | undefined;
}

/**
 * Result of the HTML cleaning process
 */
export interface CleanupResult {
  /** Cleaned HTML string */
  html: string;
  /** CSS to inject for hiding elements */
  hideCSS: string;
  /** Number of elements removed from DOM */
  removedCount: number;
  /** Number of elements hidden via CSS */
  hiddenCount: number;
  /** Number of normalization operations performed */
  normalizedCount: number;
  /** Detected provider name */
  provider: string | null;
  /** Selector that matched as content root */
  contentRoot: string | null;
  /** Debug info (if debug enabled) */
  debugInfo?:
    | {
        decisions: ElementDecision[];
        processingTimeMs: number;
      }
    | undefined;
  /** XPath validation results (if validation was requested) */
  xpathValidation?: XPathValidationResult[] | undefined;
}

/**
 * Result of XPath stability validation
 * Used to verify that saved XPaths remain valid after DOM normalization
 */
export interface XPathValidationResult {
  /** Whether the XPath resolves to the same text after normalization */
  isStable: boolean;
  /** The original XPath that was validated */
  originalXPath: string;
  /** Whether the XPath resolved to an element */
  resolvedElement: boolean;
  /** Character offset shift (0 if stable, positive/negative if shifted) */
  characterOffsetShift: number;
  /** Recommendation for handling this selection */
  recommendation: 'safe' | 'recompute' | 'skip_normalization';
  /** The expected text that should be at this location */
  expectedText?: string;
  /** The actual text found at the location (if different) */
  actualText?: string;
}

/**
 * An existing selection to validate during HTML cleaning
 */
export interface ExistingSelection {
  /** XPath to the element containing the selection */
  xpath: string;
  /** Character offset where selection starts within the element */
  charStart: number;
  /** Character offset where selection ends within the element */
  charEnd: number;
  /** The expected text content of the selection */
  text: string;
}

/**
 * Extended cleanup options that include XPath validation
 */
export interface CleanupOptionsWithValidation extends CleanupOptions {
  /** Validate XPath stability before and after normalization */
  validateXPaths?: boolean;
  /** Existing selections to validate (from saved annotations) */
  existingSelections?: ExistingSelection[];
}
