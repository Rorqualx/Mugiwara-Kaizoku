/**
 * XPath Validation Functions
 *
 * Validates that saved XPath references remain stable after DOM normalization.
 * Used to verify annotation selections can be accurately reconstructed.
 */

import type { XPathValidationResult, ExistingSelection } from './types';

/**
 * Snapshot of an XPath's state before normalization
 */
interface XPathSnapshot {
  xpath: string;
  element: Element | null;
  textContent: string;
  charStart: number;
  charEnd: number;
  expectedText: string;
  extractedText: string;
}

/**
 * Evaluate an XPath and return the matching element
 */
function evaluateXPath(doc: Document, xpath: string): Element | null {
  try {
    const result = doc.evaluate(
      xpath,
      doc,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    );
    return result.singleNodeValue as Element | null;
  } catch {
    return null;
  }
}

/**
 * Extract text at specific character offsets from an element's text content
 */
function extractTextAtOffsets(
  element: Element,
  charStart: number,
  charEnd: number
): string {
  const fullText = element.textContent ?? '';
  if (charStart < 0 || charEnd > fullText.length || charStart >= charEnd) {
    return '';
  }
  return fullText.substring(charStart, charEnd);
}

/**
 * Capture XPath snapshots before normalization
 */
export function captureXPathSnapshots(
  doc: Document,
  selections: ExistingSelection[]
): Map<string, XPathSnapshot> {
  const snapshots = new Map<string, XPathSnapshot>();

  for (const selection of selections) {
    const element = evaluateXPath(doc, selection.xpath);
    const textContent = element?.textContent ?? '';
    const extractedText = element
      ? extractTextAtOffsets(element, selection.charStart, selection.charEnd)
      : '';

    snapshots.set(selection.xpath, {
      xpath: selection.xpath,
      element,
      textContent,
      charStart: selection.charStart,
      charEnd: selection.charEnd,
      expectedText: selection.text,
      extractedText,
    });
  }

  return snapshots;
}

/**
 * Find the new character offset after text normalization
 * Returns the offset shift (0 if unchanged, positive/negative if shifted)
 */
function findOffsetShift(
  originalText: string,
  normalizedText: string,
  originalOffset: number,
  targetText: string
): number {
  if (originalText === normalizedText) return 0;

  const normalizedIndex = normalizedText.indexOf(targetText);
  if (normalizedIndex === -1) return 0;

  return normalizedIndex - originalOffset;
}

/**
 * Create a validation result for an unresolved XPath
 */
function createUnresolvedResult(
  xpath: string,
  expectedText: string,
  recommendation: XPathValidationResult['recommendation']
): XPathValidationResult {
  return {
    isStable: false,
    originalXPath: xpath,
    resolvedElement: false,
    characterOffsetShift: 0,
    recommendation,
    expectedText,
  };
}

/**
 * Validate XPath snapshots after normalization
 */
export function validateXPathSnapshots(
  doc: Document,
  snapshots: Map<string, XPathSnapshot>,
  selections: ExistingSelection[]
): XPathValidationResult[] {
  const results: XPathValidationResult[] = [];

  for (const selection of selections) {
    const snapshot = snapshots.get(selection.xpath);
    if (!snapshot) {
      results.push(
        createUnresolvedResult(selection.xpath, selection.text, 'skip_normalization')
      );
      continue;
    }

    const result = validateSingleSnapshot(doc, snapshot, selection);
    results.push(result);
  }

  return results;
}

/**
 * Validate a single XPath snapshot against post-normalization state
 */
function validateSingleSnapshot(
  doc: Document,
  snapshot: XPathSnapshot,
  selection: ExistingSelection
): XPathValidationResult {
  const elementAfter = evaluateXPath(doc, selection.xpath);

  if (!elementAfter) {
    return createUnresolvedResult(selection.xpath, selection.text, 'recompute');
  }

  const textAfter = elementAfter.textContent ?? '';
  const extractedAfter = extractTextAtOffsets(
    elementAfter,
    selection.charStart,
    selection.charEnd
  );

  const isStable = extractedAfter === selection.text;

  let characterOffsetShift = 0;
  if (!isStable && selection.text) {
    characterOffsetShift = findOffsetShift(
      snapshot.textContent,
      textAfter,
      selection.charStart,
      selection.text
    );
  }

  const recommendation = determineRecommendation(isStable, characterOffsetShift);

  return {
    isStable,
    originalXPath: selection.xpath,
    resolvedElement: true,
    characterOffsetShift,
    recommendation,
    expectedText: selection.text,
    actualText: extractedAfter,
  };
}

/**
 * Determine the recommendation based on stability and offset shift
 */
function determineRecommendation(
  isStable: boolean,
  characterOffsetShift: number
): XPathValidationResult['recommendation'] {
  if (isStable) return 'safe';
  if (characterOffsetShift !== 0) return 'recompute';
  return 'skip_normalization';
}

/**
 * Validate a single XPath for stability (exported for external use)
 */
export function validateXPathStability(
  doc: Document,
  xpath: string,
  expectedText: string,
  charStart: number,
  charEnd: number
): XPathValidationResult {
  const element = evaluateXPath(doc, xpath);

  if (!element) {
    return createUnresolvedResult(xpath, expectedText, 'recompute');
  }

  const extractedText = extractTextAtOffsets(element, charStart, charEnd);
  const isStable = extractedText === expectedText;

  return {
    isStable,
    originalXPath: xpath,
    resolvedElement: true,
    characterOffsetShift: 0,
    recommendation: isStable ? 'safe' : 'recompute',
    expectedText,
    actualText: extractedText,
  };
}
