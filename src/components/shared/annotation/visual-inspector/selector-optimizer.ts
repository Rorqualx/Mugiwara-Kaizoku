/**
 * Selector Optimizer Utility
 *
 * Generates optimized, unique CSS selectors for HTML elements.
 * Uses css-selector-generator library for robust selector creation.
 *
 * Features:
 * - Generate unique selectors
 * - Optimize selectors for brevity
 * - Fallback strategies for complex elements
 * - Selector validation and testing
 *
 * @module utils/selectorOptimizer
 */

import { getCssSelector } from 'css-selector-generator';

/**
 * Selector optimization options
 */
export interface SelectorOptions {
  /** Prefer ID selectors when available (default: true) */
  includeId?: boolean;
  /** Prefer class selectors (default: true) */
  includeClass?: boolean;
  /** Include tag names in selectors (default: true) */
  includeTag?: boolean;
  /** Use nth-child for specificity (default: false) */
  includeNth?: boolean;
  /** Maximum selector length (default: 100) */
  maxLength?: number;
}

/**
 * Generated selector result
 */
export interface SelectorResult {
  /** The CSS selector string */
  selector: string;
  /** Specificity score (higher = more specific) */
  specificity: number;
  /** Whether the selector is unique in the document */
  isUnique: boolean;
  /** Alternative selectors if primary selector is not optimal */
  alternatives?: string[];
}

/**
 * Generate optimized CSS selector for an element
 */
export function generateOptimizedSelector(
  element: Element,
  options: SelectorOptions = {}
): string {
  // Default options
  const opts = {
    includeId: options.includeId !== false,
    includeClass: options.includeClass !== false,
    includeTag: options.includeTag !== false,
    includeNth: options.includeNth === true,
    maxLength: options.maxLength ?? 100
  };

  try {
    // Use css-selector-generator library
    const selector = getCssSelector(element, {
      selectors: [
        opts.includeId ? 'id' : undefined,
        opts.includeClass ? 'class' : undefined,
        opts.includeTag ? 'tag' : undefined,
        opts.includeNth ? 'nthchild' : undefined
      ].filter(Boolean) as Array<'id' | 'class' | 'tag' | 'nthchild' | 'attribute' | 'nthoftype'>,
      root: element.ownerDocument.body,
      combineWithinSelector: true,
      combineBetweenSelectors: true
    });

    // Truncate if too long
    if (selector.length > opts.maxLength) {
      return simplifySelector(selector, opts.maxLength);
    }

    return selector;
  } catch (_error) {
    // Fallback to basic selector if library fails
    return generateFallbackSelector(element);
  }
}

/**
 * Generate selector with validation result
 */
export function generateSelectorWithValidation(
  element: Element,
  options: SelectorOptions = {}
): SelectorResult {
  const selector = generateOptimizedSelector(element, options);
  const document = element.ownerDocument;

  // Test uniqueness
  const matches = document.querySelectorAll(selector);
  const isUnique = matches.length === 1 && matches[0] === element;

  // Calculate specificity
  const specificity = calculateSpecificity(selector);

  // Generate alternatives if not unique
  const alternatives: string[] = [];
  if (!isUnique) {
    // Try with nth-child
    const withNth = generateOptimizedSelector(element, { ...options, includeNth: true });
    if (withNth !== selector) {
      alternatives.push(withNth);
    }

    // Try with full path
    const fullPath = generateFullPathSelector(element);
    if (fullPath !== selector && fullPath !== withNth) {
      alternatives.push(fullPath);
    }
  }

  const result: SelectorResult = {
    selector,
    specificity,
    isUnique
  };

  if (alternatives.length > 0) {
    result.alternatives = alternatives;
  }

  return result;
}

/**
 * Simplify a long selector to fit max length
 */
function simplifySelector(selector: string, maxLength: number): string {
  // Split by descendant combinators
  const parts = selector.split(' > ');

  // If still too long, take last N parts
  if (selector.length > maxLength && parts.length > 2) {
    // Take last 2 parts (most specific)
    return parts.slice(-2).join(' > ');
  }

  return selector;
}

/**
 * Generate fallback selector when library fails
 */
function generateFallbackSelector(element: Element): string {
  const parts: string[] = [];
  let current: Element | null = element;

  while (current && current !== current.ownerDocument.body && parts.length < 5) {
    let part = current.tagName.toLowerCase();

    // Add ID if present (most specific)
    if (current.id) {
      part += `#${current.id}`;
      parts.unshift(part);
      break; // ID is unique, stop here
    }

    // Add first class if present
    if (current.className && typeof current.className === 'string') {
      const classes = current.className.trim().split(/\s+/);
      if (classes.length > 0 && classes[0]) {
        part += `.${classes[0]}`;
      }
    }

    parts.unshift(part);
    current = current.parentElement;
  }

  return parts.join(' > ');
}

/**
 * Generate full path selector from body to element
 */
function generateFullPathSelector(element: Element): string {
  const parts: string[] = [];
  let current: Element | null = element;

  while (current && current !== current.ownerDocument.body) {
    let selector = current.tagName.toLowerCase();

    // Add ID if present
    if (current.id) {
      selector += `#${current.id}`;
      parts.unshift(selector);
      break;
    }

    // Add nth-child for specificity
    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children);
      const index = siblings.indexOf(current);
      selector += `:nth-child(${index + 1})`;
    }

    parts.unshift(selector);
    current = current.parentElement;
  }

  return parts.join(' > ');
}

/**
 * Calculate CSS selector specificity
 * Returns a score: ID=100, Class=10, Element=1
 */
function calculateSpecificity(selector: string): number {
  let score = 0;

  // Count IDs (#)
  score += (selector.match(/#/g) ?? []).length * 100;

  // Count classes (.)
  score += (selector.match(/\./g) ?? []).length * 10;

  // Count pseudo-classes (:)
  score += (selector.match(/:/g) ?? []).length * 10;

  // Count elements (rough estimate)
  const elements = selector.split(/[>\s+~]/).filter(Boolean);
  score += elements.length;

  return score;
}

/**
 * Test if a selector uniquely identifies an element
 * @internal Used for testing and validation purposes
 */
export function testSelectorUniqueness(
  selector: string,
  element: Element
): boolean {
  const document = element.ownerDocument;
  const matches = document.querySelectorAll(selector);
  return matches.length === 1 && matches[0] === element;
}

/**
 * Get all elements matching a selector
 * @internal Used for testing and validation purposes
 */
export function testSelector(
  selector: string,
  document: Document
): Element[] {
  try {
    return Array.from(document.querySelectorAll(selector));
  } catch (_error) {
    // Invalid selector
    return [];
  }
}

/**
 * Optimize an existing selector for brevity
 * @internal Reserved for future use in selector refinement workflows
 */
export function optimizeExistingSelector(
  selector: string,
  document: Document
): string {
  // Test if selector works
  const elements = testSelector(selector, document);
  if (elements.length === 0) {
    return selector; // Can't optimize if it doesn't work
  }

  // Get first match
  const element = elements[0];
  if (!element) {
    return selector; // No elements found, return original
  }

  // Generate optimized version
  return generateOptimizedSelector(element);
}
