/**
 * Selector Matcher Utility
 *
 * Handles CSS selectors including :contains() pseudo-selector
 * which is not standard CSS but commonly used in jQuery/wikis.
 *
 * In Node.js/browser environments, :contains() doesn't work with
 * querySelectorAll, so we implement custom matching.
 *
 * @module shared/source-knowledge/selectors/selector-matcher
 */

/**
 * Match elements using a selector that may contain :contains()
 *
 * @param doc - Document or Element to search within
 * @param selector - CSS selector (may include :contains())
 * @returns Array of matching elements
 */
export function matchSelector(doc: Document | Element, selector: string): Element[] {
  // Check if selector contains :contains() pseudo-selector
  const containsMatch = selector.match(/:contains\(["']([^"']+)["']\)/);

  if (!containsMatch) {
    // Standard CSS selector - use querySelectorAll
    try {
      return Array.from(doc.querySelectorAll(selector));
    } catch {
      return [];
    }
  }

  // Parse the :contains() selector
  const searchText = containsMatch[1] ?? '';
  const parts = splitContainsSelector(selector);

  if (!parts || !searchText) {
    return [];
  }

  return findElementsWithContains(doc, parts.before, searchText, parts.after);
}

/**
 * Split a selector around :contains()
 *
 * Example: ".infobox th:contains('Author') + td"
 * Returns: { before: ".infobox th", after: " + td" }
 */
function splitContainsSelector(
  selector: string
): { before: string; after: string } | null {
  const containsPattern = /:contains\(["'][^"']+["']\)/;
  const match = selector.match(containsPattern);
  const matchIndex = match?.index;
  const matchLength = match?.[0]?.length ?? 0;

  if (matchIndex === undefined || matchLength === 0) {
    return null;
  }

  const before = selector.substring(0, matchIndex).trim();
  const after = selector.substring(matchIndex + matchLength).trim();

  return { before, after };
}

/**
 * Find elements matching :contains() pattern
 */
function findElementsWithContains(
  doc: Document | Element,
  beforeSelector: string,
  searchText: string,
  afterSelector: string
): Element[] {
  // Find all elements matching the "before" selector
  let candidates: Element[];
  try {
    candidates = Array.from(doc.querySelectorAll(beforeSelector));
  } catch {
    return [];
  }

  // Filter to those containing the search text
  const textMatchers = candidates.filter((el) => {
    const text = el.textContent?.toLowerCase() ?? '';
    return text.includes(searchText.toLowerCase());
  });

  // If no "after" selector (combinator), return the matches directly
  if (!afterSelector) {
    return textMatchers;
  }

  // Handle combinators: + (adjacent sibling), ~ (general sibling)
  return resolveAfterCombinator(textMatchers, afterSelector);
}

/**
 * Resolve combinator selectors relative to matched elements
 */
function resolveAfterCombinator(
  elements: Element[],
  afterSelector: string
): Element[] {
  const trimmed = afterSelector.trim();

  if (trimmed.startsWith('+')) {
    return resolveAdjacentSibling(elements, trimmed.substring(1).trim());
  }

  if (trimmed.startsWith('~')) {
    return resolveGeneralSibling(elements, trimmed.substring(1).trim());
  }

  if (trimmed.startsWith('>')) {
    return resolveDirectChild(elements, trimmed.substring(1).trim());
  }

  // Descendant combinator (space)
  return resolveDescendant(elements, trimmed);
}

/**
 * Resolve adjacent sibling combinator (+)
 */
function resolveAdjacentSibling(elements: Element[], siblingSelector: string): Element[] {
  const results: Element[] = [];
  for (const el of elements) {
    const sibling = el.nextElementSibling;
    if (sibling && matchesSelector(sibling, siblingSelector)) {
      results.push(sibling);
    }
  }
  return results;
}

/**
 * Resolve general sibling combinator (~)
 */
function resolveGeneralSibling(elements: Element[], siblingSelector: string): Element[] {
  const results: Element[] = [];
  for (const el of elements) {
    let sibling = el.nextElementSibling;
    while (sibling) {
      if (matchesSelector(sibling, siblingSelector)) {
        results.push(sibling);
      }
      sibling = sibling.nextElementSibling;
    }
  }
  return results;
}

/**
 * Resolve direct child combinator (>)
 */
function resolveDirectChild(elements: Element[], childSelector: string): Element[] {
  const results: Element[] = [];
  for (const el of elements) {
    const children = el.querySelectorAll(`:scope > ${childSelector}`);
    results.push(...Array.from(children));
  }
  return results;
}

/**
 * Resolve descendant combinator (space)
 */
function resolveDescendant(elements: Element[], selector: string): Element[] {
  const results: Element[] = [];
  for (const el of elements) {
    try {
      const descendants = el.querySelectorAll(selector);
      results.push(...Array.from(descendants));
    } catch {
      // Invalid selector, skip
    }
  }
  return results;
}

/**
 * Check if element matches a simple selector
 */
function matchesSelector(element: Element, selector: string): boolean {
  if (!selector) return true;

  try {
    return element.matches(selector);
  } catch {
    return false;
  }
}

/**
 * Match multiple selectors, returning first match for each
 *
 * @param doc - Document or Element to search within
 * @param selectors - Array of CSS selectors
 * @returns First matching element, or null
 */
export function matchFirstSelector(
  doc: Document | Element,
  selectors: string[]
): Element | null {
  for (const selector of selectors) {
    const matches = matchSelector(doc, selector);
    const firstMatch = matches[0];
    if (firstMatch !== undefined) {
      return firstMatch;
    }
  }
  return null;
}

/**
 * Match multiple selectors, returning all matches
 *
 * @param doc - Document or Element to search within
 * @param selectors - Array of CSS selectors
 * @returns All matching elements (deduplicated)
 */
export function matchAllSelectors(
  doc: Document | Element,
  selectors: string[]
): Element[] {
  const seen = new Set<Element>();
  const results: Element[] = [];

  for (const selector of selectors) {
    const matches = matchSelector(doc, selector);
    for (const el of matches) {
      if (!seen.has(el)) {
        seen.add(el);
        results.push(el);
      }
    }
  }

  return results;
}

/**
 * Extract text content from elements matching selectors
 *
 * @param doc - Document or Element to search within
 * @param selectors - Array of CSS selectors
 * @returns Text content of first matching element, or null
 */
export function extractTextFromSelectors(
  doc: Document | Element,
  selectors: string[]
): string | null {
  const element = matchFirstSelector(doc, selectors);
  return element?.textContent?.trim() ?? null;
}

/**
 * Extract multiple text values from matching elements
 *
 * @param doc - Document or Element to search within
 * @param selectors - Array of CSS selectors
 * @returns Array of text content from all matches
 */
export function extractAllTextFromSelectors(
  doc: Document | Element,
  selectors: string[]
): string[] {
  const elements = matchAllSelectors(doc, selectors);
  return elements
    .map((el) => el.textContent?.trim())
    .filter((text): text is string => Boolean(text));
}
