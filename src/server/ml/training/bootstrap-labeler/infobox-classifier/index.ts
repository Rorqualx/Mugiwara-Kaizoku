/**
 * Infobox Type Classifier
 *
 * Classifies infobox structure to apply appropriate extraction strategy.
 */

import type { LinearizedToken } from '@/server/ml/features/dom-linearizer';

export type InfoboxType =
  | 'fandom_portable' // Fandom portable-infobox with data-source
  | 'wikipedia_table' // Wikipedia .infobox table
  | 'generic_table' // Generic table-based infobox
  | 'definition_list' // dl/dt/dd structure
  | 'unknown';

export interface InfoboxClassification {
  type: InfoboxType;
  confidence: number;
  containerSelector: string;
  labelSelector: string;
  valueSelector: string;
}

export interface InfoboxSignature {
  containerClasses: string[];
  labelClasses: string[];
  valueClasses: string[];
  dataAttributes?: string[];
}

/**
 * Signature patterns for detecting different infobox types.
 * Exported for use by other modules that need to understand infobox structure.
 */
export const INFOBOX_SIGNATURES: Record<InfoboxType, InfoboxSignature> = {
  fandom_portable: {
    containerClasses: ['portable-infobox', 'pi-data', 'pi-theme'],
    labelClasses: ['pi-data-label', 'pi-secondary-font'],
    valueClasses: ['pi-data-value', 'pi-font'],
    dataAttributes: ['data-source'],
  },
  wikipedia_table: {
    containerClasses: ['infobox', 'infobox-manga', 'vcard', 'vevent'],
    labelClasses: [], // Uses th elements
    valueClasses: [], // Uses td elements
  },
  generic_table: {
    containerClasses: ['info-box', 'sidebar', 'wikitable'],
    labelClasses: [],
    valueClasses: [],
  },
  definition_list: {
    containerClasses: ['definition-list', 'dl-horizontal'],
    labelClasses: [],
    valueClasses: [],
  },
  unknown: {
    containerClasses: [],
    labelClasses: [],
    valueClasses: [],
  },
};

/**
 * Check if token classes contain any of the target classes
 */
function hasAnyClass(tokenClasses: string[], targetClasses: string[]): boolean {
  return targetClasses.some((target) =>
    tokenClasses.some((tc) => tc.toLowerCase().includes(target.toLowerCase()))
  );
}

/**
 * Detect Fandom portable-infobox structure
 */
function detectFandomInfobox(tokens: LinearizedToken[]): number {
  let score = 0;

  for (const token of tokens) {
    if (hasAnyClass(token.classes, ['portable-infobox', 'pi-data'])) {
      score += 2;
    }
    if (hasAnyClass(token.classes, ['pi-data-label', 'pi-data-value'])) {
      score += 1;
    }
    // Check for data-source attribute in xpath/cssPath
    if (token.cssPath.includes('[data-source]')) {
      score += 2;
    }
  }

  return Math.min(1.0, score / 10);
}

/**
 * Detect Wikipedia infobox table structure
 */
function detectWikipediaInfobox(tokens: LinearizedToken[]): number {
  let score = 0;
  let hasInfoboxClass = false;
  let hasThTdStructure = false;

  for (const token of tokens) {
    if (hasAnyClass(token.classes, ['infobox'])) {
      hasInfoboxClass = true;
      score += 3;
    }
    if (token.isInTable && token.isTableHeader) {
      hasThTdStructure = true;
      score += 0.5;
    }
  }

  if (hasInfoboxClass && hasThTdStructure) {
    score += 2;
  }

  return Math.min(1.0, score / 8);
}

/**
 * Detect definition list structure
 */
function detectDefinitionList(tokens: LinearizedToken[]): number {
  let dtCount = 0;
  let ddCount = 0;

  for (const token of tokens) {
    if (token.tagName === 'dt') dtCount++;
    if (token.tagName === 'dd') ddCount++;
  }

  if (dtCount === 0) return 0;

  // Good ratio of dt to dd suggests definition list
  const ratio = ddCount / dtCount;
  if (ratio >= 0.5 && ratio <= 3) {
    return Math.min(1.0, (dtCount + ddCount) / 20);
  }

  return 0;
}

/**
 * Classify the infobox type from tokens
 */
export function classifyInfobox(tokens: LinearizedToken[]): InfoboxClassification {
  const fandomScore = detectFandomInfobox(tokens);
  const wikipediaScore = detectWikipediaInfobox(tokens);
  const definitionScore = detectDefinitionList(tokens);

  // Find the highest scoring type
  const scores: Array<{ type: InfoboxType; score: number }> = [
    { type: 'fandom_portable', score: fandomScore },
    { type: 'wikipedia_table', score: wikipediaScore },
    { type: 'definition_list', score: definitionScore },
  ];

  scores.sort((a, b) => b.score - a.score);
  const best = scores[0];

  if (!best || best.score < 0.3) {
    return createUnknownClassification();
  }

  return createClassification(best.type, best.score);
}

/**
 * Create classification result for unknown type
 */
function createUnknownClassification(): InfoboxClassification {
  return {
    type: 'unknown',
    confidence: 0,
    containerSelector: '',
    labelSelector: '',
    valueSelector: '',
  };
}

/**
 * Create classification result for a specific type
 */
function createClassification(type: InfoboxType, confidence: number): InfoboxClassification {
  const selectors = getSelectorsForType(type);
  return {
    type,
    confidence,
    ...selectors,
  };
}

/**
 * Get selectors for a specific infobox type
 */
function getSelectorsForType(type: InfoboxType): {
  containerSelector: string;
  labelSelector: string;
  valueSelector: string;
} {
  switch (type) {
    case 'fandom_portable':
      return {
        containerSelector: '.portable-infobox',
        labelSelector: '.pi-data-label',
        valueSelector: '.pi-data-value',
      };
    case 'wikipedia_table':
      return {
        containerSelector: '.infobox',
        labelSelector: '.infobox th',
        valueSelector: '.infobox td',
      };
    case 'definition_list':
      return {
        containerSelector: 'dl',
        labelSelector: 'dt',
        valueSelector: 'dd',
      };
    case 'generic_table':
      return {
        containerSelector: 'table',
        labelSelector: 'th',
        valueSelector: 'td',
      };
    default:
      return {
        containerSelector: '',
        labelSelector: '',
        valueSelector: '',
      };
  }
}

/**
 * Check if tokens likely contain an infobox
 */
export function hasInfobox(tokens: LinearizedToken[]): boolean {
  return tokens.some((t) => t.isInInfobox);
}

/**
 * Get infobox tokens from the full token stream
 */
export function getInfoboxTokens(tokens: LinearizedToken[]): LinearizedToken[] {
  return tokens.filter((t) => t.isInInfobox);
}
