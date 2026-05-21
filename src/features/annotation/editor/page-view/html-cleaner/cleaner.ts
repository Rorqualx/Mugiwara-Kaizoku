/**
 * HTML Cleaner Core
 *
 * Cleans HTML snapshots by removing/hiding unwanted UI elements
 * while preserving content structure for annotation.
 */

import { detectProvider, getProviderByName } from './providers';
import { captureXPathSnapshots, validateXPathSnapshots } from './xpath-validation';

import type {
  ProviderProfile,
  CleanupOptions,
  CleanupResult,
  ElementDecision,
  ElementAction,
  NormalizationOptions,
  XPathValidationResult,
  CleanupOptionsWithValidation,
} from './types';

/**
 * Clean HTML for annotation display
 *
 * This function:
 * 1. Parses HTML into a DOM tree
 * 2. Identifies the content root (main content container)
 * 3. Removes elements that are safe to remove (outside content)
 * 4. Generates CSS to hide remaining unwanted elements
 * 5. Optionally validates XPath stability for existing selections
 */
// eslint-disable-next-line complexity -- HTML cleanup with provider detection, content root identification, and element filtering
export function cleanHtmlForAnnotation(
  html: string,
  options: CleanupOptions | CleanupOptionsWithValidation = {}
): CleanupResult {
  const startTime = performance.now();
  const decisions: ElementDecision[] = [];

  // Detect provider
  const profile = options.forceProvider
    ? getProviderByName(options.forceProvider) ?? detectProvider(options.sourceUrl)
    : detectProvider(options.sourceUrl);

  // Parse HTML
  const doc = parseHtml(html);
  if (!doc) {
    return createEmptyResult(html, profile.name);
  }

  // Find content root
  const contentRoot = findContentRoot(doc, profile);

  // Process removals (only if not hideOnly mode)
  let removedCount = 0;
  if (!options.hideOnly) {
    removedCount = processRemovals(doc, profile, contentRoot, decisions);
    // Force-remove content noise elements (e.g., citation markers)
    // These must be removed even inside the content root to match server-side tokenization
    removedCount += processContentRemovals(doc, profile, decisions);
  }

  // XPath validation - capture snapshots before normalization
  // Default to true if there are existing selections (opt-out rather than opt-in)
  const extendedOptions = options as CleanupOptionsWithValidation;
  const hasExistingSelections = (extendedOptions.existingSelections?.length ?? 0) > 0;
  const shouldValidateXPaths =
    hasExistingSelections && (extendedOptions.validateXPaths ?? true);
  const preNormSnapshots = shouldValidateXPaths
    ? captureXPathSnapshots(doc, extendedOptions.existingSelections ?? [])
    : null;

  // DOM Normalization - improves XPath/char offset reliability
  let normalizedCount = 0;
  if (!options.skipNormalization) {
    const normOptions = options.normalization ?? profile.normalization;
    if (normOptions) {
      normalizedCount = normalizeDOM(doc, normOptions, contentRoot);
    }
  }

  // XPath validation - compare after normalization
  let xpathValidation: XPathValidationResult[] | undefined;
  if (shouldValidateXPaths && preNormSnapshots) {
    xpathValidation = validateXPathSnapshots(
      doc,
      preNormSnapshots,
      extendedOptions.existingSelections ?? []
    );
  }

  // Generate hide CSS
  const { css: hideCSS, count: hiddenCount } = generateHideCSS(profile, decisions);

  // Inject hide CSS into document head
  if (hideCSS) {
    injectCSSIntoDocument(doc, hideCSS);
  }

  // Serialize back to HTML
  const cleanedHtml = serializeHtml(doc);

  const processingTimeMs = performance.now() - startTime;

  return {
    html: cleanedHtml,
    hideCSS,
    removedCount,
    hiddenCount,
    normalizedCount,
    provider: profile.name,
    contentRoot: contentRoot?.tagName.toLowerCase() ?? null,
    debugInfo: options.debug ? { decisions, processingTimeMs } : undefined,
    xpathValidation,
  };
}

/**
 * Parse HTML string into a Document
 */
function parseHtml(html: string): Document | null {
  try {
    const parser = new DOMParser();
    return parser.parseFromString(html, 'text/html');
  } catch {
    return null;
  }
}

/**
 * Create an empty result when parsing fails
 */
function createEmptyResult(html: string, provider: string | null): CleanupResult {
  return {
    html,
    hideCSS: '',
    removedCount: 0,
    hiddenCount: 0,
    normalizedCount: 0,
    provider,
    contentRoot: null,
  };
}

/**
 * Find the main content container in the document
 */
function findContentRoot(doc: Document, profile: ProviderProfile): Element | null {
  for (const selector of profile.contentSelectors) {
    const element = doc.querySelector(selector);
    if (element) return element;
  }
  // Fallback to body
  return doc.body;
}

/**
 * Build a set of preserved elements and their ancestors
 */
function buildPreservedSet(doc: Document, profile: ProviderProfile, contentRoot: Element | null): Set<Element> {
  const preserved = new Set<Element>();

  // Always preserve html, head, body
  preserved.add(doc.documentElement);
  preserved.add(doc.head);
  preserved.add(doc.body);

  // Preserve content root and all ancestors
  if (contentRoot) {
    preserved.add(contentRoot);
    addAncestorsToSet(contentRoot, preserved);
  }

  // Preserve explicitly listed selectors
  for (const selector of profile.preserveSelectors) {
    // Skip wildcard selectors for this check (e.g., ".mw-parser-output *")
    if (selector.includes(' *')) continue;

    const elements = doc.querySelectorAll(selector);
    elements.forEach((el) => {
      preserved.add(el);
      addAncestorsToSet(el, preserved);
    });
  }

  return preserved;
}

/**
 * Add all ancestors of an element to a set
 */
function addAncestorsToSet(element: Element, set: Set<Element>): void {
  let parent = element.parentElement;
  while (parent) {
    set.add(parent);
    parent = parent.parentElement;
  }
}

/**
 * Check if an element is safe to remove
 */
function canSafelyRemove(
  element: Element,
  contentRoot: Element | null,
  preserved: Set<Element>
): ElementAction {
  // Never remove preserved elements
  if (preserved.has(element)) return 'keep';

  // Never remove if it contains the content root
  if (contentRoot && element.contains(contentRoot)) return 'keep';

  // Check if element is inside content root - if so, hide instead of remove
  if (contentRoot?.contains(element)) return 'hide';

  // Safe to remove if completely outside content tree
  return 'remove';
}

/**
 * Process removal selectors and remove safe elements
 */
function processRemovals(
  doc: Document,
  profile: ProviderProfile,
  contentRoot: Element | null,
  decisions: ElementDecision[]
): number {
  const preserved = buildPreservedSet(doc, profile, contentRoot);
  let removedCount = 0;

  for (const selector of profile.removeSelectors) {
    const elements = doc.querySelectorAll(selector);

    elements.forEach((element) => {
      const action = canSafelyRemove(element, contentRoot, preserved);

      decisions.push({
        selector,
        action,
        category: categorizeSelector(selector),
        score: 100, // Direct selector match = high confidence
        reason: action === 'remove' ? 'Outside content tree' : 'Inside/contains content',
      });

      if (action === 'remove') {
        element.remove();
        removedCount++;
      }
    });
  }

  return removedCount;
}

/**
 * Force-remove content noise elements from the DOM
 *
 * Unlike processRemovals (which converts to 'hide' for elements inside the content root),
 * this function removes elements matching contentRemoveSelectors regardless of their position.
 * This is necessary for elements like citation markers (.reference) that the server strips
 * before tokenization - the client must also strip them for XPaths and selectionText to match.
 */
function processContentRemovals(
  doc: Document,
  profile: ProviderProfile,
  decisions: ElementDecision[]
): number {
  const contentRemoveSelectors = profile.contentRemoveSelectors;
  if (!contentRemoveSelectors || contentRemoveSelectors.length === 0) return 0;

  let removedCount = 0;

  for (const selector of contentRemoveSelectors) {
    const elements = doc.querySelectorAll(selector);

    elements.forEach((element) => {
      decisions.push({
        selector,
        action: 'remove',
        category: categorizeSelector(selector),
        score: 100,
        reason: 'Content noise removal (server-side alignment)',
      });

      element.remove();
      removedCount++;
    });
  }

  return removedCount;
}

/**
 * Categorize a selector by its likely purpose
 */
// eslint-disable-next-line complexity -- Selector categorization with multiple pattern checks for element purpose detection
function categorizeSelector(selector: string): ElementDecision['category'] {
  const lower = selector.toLowerCase();
  if (lower.includes('cookie') || lower.includes('consent') || lower.includes('onetrust')) {
    return 'cookie';
  }
  if (lower.includes('nav') || lower.includes('header') || lower.includes('footer')) {
    return 'navigation';
  }
  if (lower.includes('ad') || lower.includes('sponsor')) {
    return 'ad';
  }
  if (lower.includes('modal') || lower.includes('overlay') || lower.includes('popup')) {
    return 'overlay';
  }
  if (lower.includes('sticky') || lower.includes('fixed')) {
    return 'sticky';
  }
  if (lower.includes('video') || lower.includes('player') || lower.includes('jw')) {
    return 'video';
  }
  if (lower.includes('social') || lower.includes('share')) {
    return 'social';
  }
  if (lower.includes('script') || lower.includes('beacon') || lower.includes('pixel')) {
    return 'tracking';
  }
  return 'overlay'; // Default category
}

/**
 * Generate CSS to hide elements that couldn't be safely removed
 */
function generateHideCSS(
  profile: ProviderProfile,
  decisions: ElementDecision[]
): { css: string; count: number } {
  const hideSelectors: string[] = [];

  // Add profile's hide selectors
  hideSelectors.push(...profile.hideSelectors);

  // Add selectors that were marked as 'hide' during removal processing
  const hideDecisions = decisions.filter((d) => d.action === 'hide');
  hideDecisions.forEach((d) => {
    if (!hideSelectors.includes(d.selector)) {
      hideSelectors.push(d.selector);
    }
  });

  if (hideSelectors.length === 0) {
    return { css: '', count: 0 };
  }

  // Build CSS with specific selectors to avoid matching html/body
  const safeSelectors = hideSelectors.map(makeSelectorSafe).filter(Boolean);

  const css = `
    /* Auto-generated hide CSS for ${profile.name} */
    ${safeSelectors.join(',\n    ')} {
      display: none !important;
      visibility: hidden !important;
    }
  `;

  return { css, count: safeSelectors.length };
}

/**
 * Make a selector safe by ensuring it won't accidentally match html/body
 */
function makeSelectorSafe(selector: string): string {
  // If selector is an attribute selector that could match html/body, add :not() guards
  if (selector.startsWith('[class*=') || selector.startsWith('[id*=')) {
    return `${selector}:not(html):not(body)`;
  }

  // If it's a bare element selector that could be broad, skip it
  const bareElements = ['div', 'span', 'section', 'aside', 'article'];
  if (bareElements.includes(selector.toLowerCase())) {
    return ''; // Skip, too broad
  }

  return selector;
}

/**
 * Inject CSS into the document's head
 */
function injectCSSIntoDocument(doc: Document, css: string): void {
  const style = doc.createElement('style');
  style.setAttribute('data-html-cleaner', 'true');
  style.textContent = css;
  doc.head.appendChild(style);
}

/**
 * Serialize Document back to HTML string
 */
function serializeHtml(doc: Document): string {
  return doc.documentElement.outerHTML;
}

// ============================================================================
// DOM Normalization Functions
// ============================================================================

/**
 * Normalize DOM for consistent text handling
 * This improves XPath/char offset reliability for selection reconstruction
 */
function normalizeDOM(
  doc: Document,
  options: NormalizationOptions,
  contentRoot: Element | null
): number {
  let operationCount = 0;
  const root = contentRoot ?? doc.body;

  // Build set of elements to preserve whitespace in
  const preserveSet = buildPreserveWhitespaceSet(doc, options.preserveWhitespaceIn ?? []);

  // Order matters: merge first, then flatten, then normalize whitespace
  if (options.mergeTextNodes) {
    // Node.normalize() merges adjacent text nodes
    root.normalize();
    operationCount++;
  }

  if (options.flattenNestedFormatting) {
    operationCount += flattenNestedInlineElements(root);
  }

  if (options.removeEmptyTextNodes) {
    operationCount += removeEmptyTextNodes(root, preserveSet);
  }

  if (options.normalizeWhitespace) {
    operationCount += normalizeWhitespaceInTextNodes(root, preserveSet);
  }

  return operationCount;
}

/**
 * Build set of elements where whitespace should be preserved
 */
function buildPreserveWhitespaceSet(doc: Document, selectors: string[]): Set<Element> {
  const preserved = new Set<Element>();
  for (const selector of selectors) {
    try {
      const elements = doc.querySelectorAll(selector);
      elements.forEach((el) => preserved.add(el));
    } catch {
      // Invalid selector, skip
    }
  }
  return preserved;
}

/**
 * Flatten nested inline formatting elements
 * e.g., <b><b>text</b></b> → <b>text</b>
 */
function flattenNestedInlineElements(root: Element): number {
  const inlineTags = ['B', 'I', 'U', 'STRONG', 'EM', 'SPAN', 'A'];
  let flattenedCount = 0;

  for (const tag of inlineTags) {
    const nestedSelector = `${tag} ${tag}`;
    const elements = root.querySelectorAll(nestedSelector);
    flattenedCount += flattenElements(elements, root);
  }

  return flattenedCount;
}

/**
 * Flatten a list of nested elements by moving children up
 */
function flattenElements(elements: NodeListOf<Element>, root: Element): number {
  let count = 0;
  elements.forEach((el) => {
    const parent = el.parentElement;
    if (!parent || parent.tagName !== el.tagName || parent === root) return;

    // Move children up, remove nested element
    while (el.firstChild) {
      parent.insertBefore(el.firstChild, el);
    }
    el.remove();
    count++;
  });
  return count;
}

/**
 * Remove empty text nodes (whitespace-only outside preserved areas)
 */
function removeEmptyTextNodes(root: Element, preserveSet: Set<Element>): number {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodesToRemove: Text[] = [];
  let node: Text | null;

  while ((node = walker.nextNode() as Text | null)) {
    if (shouldRemoveTextNode(node, preserveSet)) {
      nodesToRemove.push(node);
    }
  }

  nodesToRemove.forEach((n) => n.remove());
  return nodesToRemove.length;
}

/**
 * Check if a text node should be removed (empty/whitespace-only)
 */
function shouldRemoveTextNode(node: Text, preserveSet: Set<Element>): boolean {
  // Skip if inside a preserved element
  if (isInsidePreserved(node, preserveSet)) return false;

  // Get text content, treat null as empty
  const value = node.textContent ?? '';
  // Not empty/whitespace-only
  if (!/^\s*$/.test(value)) return false;

  // Keep single spaces between inline elements
  const prev = node.previousSibling;
  const next = node.nextSibling;
  const isInlineBoundary =
    prev?.nodeType === Node.ELEMENT_NODE &&
    isInlineElement(prev as Element) &&
    next?.nodeType === Node.ELEMENT_NODE &&
    isInlineElement(next as Element);

  // Remove if not between inline elements, or if completely empty
  return !isInlineBoundary || value.length === 0;
}

/**
 * Normalize whitespace in text nodes (collapse multiple to single space)
 */
function normalizeWhitespaceInTextNodes(root: Element, preserveSet: Set<Element>): number {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let normalizedCount = 0;
  let node: Text | null;

  while ((node = walker.nextNode() as Text | null)) {
    // Skip if inside a preserved element
    if (isInsidePreserved(node, preserveSet)) continue;

    // Get text content, skip if null
    const value = node.textContent;
    if (value === null) continue;

    if (/\s{2,}/.test(value)) {
      // Collapse multiple whitespace to single space
      node.textContent = value.replace(/\s+/g, ' ');
      normalizedCount++;
    }
  }

  return normalizedCount;
}

/**
 * Check if a node is inside a preserved element
 */
function isInsidePreserved(node: Node, preserveSet: Set<Element>): boolean {
  let parent = node.parentElement;
  while (parent) {
    if (preserveSet.has(parent)) return true;
    parent = parent.parentElement;
  }
  return false;
}

/**
 * Check if element is an inline element
 */
function isInlineElement(el: Element): boolean {
  const inlineTags = [
    'A', 'ABBR', 'B', 'BDO', 'BR', 'CITE', 'CODE', 'DFN', 'EM',
    'I', 'IMG', 'KBD', 'Q', 'SAMP', 'SMALL', 'SPAN', 'STRONG', 'SUB', 'SUP',
    'TIME', 'VAR',
  ];
  return inlineTags.includes(el.tagName);
}
