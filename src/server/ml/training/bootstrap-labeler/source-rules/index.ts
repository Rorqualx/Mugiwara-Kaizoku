/**
 * Source-Specific Rules Module
 *
 * Exports all source-specific positional rules and provides utilities
 * for retrieving rules based on source type.
 *
 * @module ml/training/bootstrap-labeler/source-rules
 */

import { COMICVINE_RULES } from './comicvine-rules/index';
import { FANDOM_RULES } from './fandom-rules';
import { WIKIPEDIA_RULES } from './wikipedia-rules';

import type { SourceRule, SourceType } from './types';

// Re-export types
export type { SourceRule, SourceRuleContext, SourceType } from './types';
export {
  findSpanEnd,
  hasAncestorClassPattern,
  hasClassPattern,
  hasExactClass,
  hasIdPattern,
  hasXPathPattern,
  isInEditorialMetadataContext,
  isLabelToken,
  isLargeImage,
} from './types';

// Re-export individual rule sets
export { FANDOM_RULES, isMangaPage, isInTableOfContents, isNavboxSectionRangeHeader } from './fandom-rules';
export { WIKIPEDIA_RULES } from './wikipedia-rules';
export { COMICVINE_RULES } from './comicvine-rules/index';

// ============================================================================
// Rule Retrieval
// ============================================================================

/**
 * Get all source-specific rules for a given source type.
 * Returns an empty array for unknown sources (they use generic rules only).
 */
export function getSourceRules(sourceType: SourceType): SourceRule[] {
  switch (sourceType) {
    case 'fandom':
      return FANDOM_RULES;
    case 'wikipedia':
      return WIKIPEDIA_RULES;
    case 'comicvine':
      return COMICVINE_RULES;
    case 'unknown':
    default:
      return [];
  }
}

/**
 * Get all rules from all sources (for testing or analysis).
 */
export function getAllSourceRules(): SourceRule[] {
  return [
    ...FANDOM_RULES,
    ...WIKIPEDIA_RULES,
    ...COMICVINE_RULES,
  ];
}

/**
 * Get rules sorted by priority (highest first).
 */
export function getSourceRulesSortedByPriority(sourceType: SourceType): SourceRule[] {
  return getSourceRules(sourceType).sort((a, b) => b.priority - a.priority);
}

// ============================================================================
// Rule Statistics
// ============================================================================

/**
 * Get statistics about the rule set for a source type.
 */
export function getSourceRuleStats(sourceType: SourceType): {
  totalRules: number;
  entityTypeCoverage: string[];
  averageConfidence: number;
} {
  const rules = getSourceRules(sourceType);

  if (rules.length === 0) {
    return {
      totalRules: 0,
      entityTypeCoverage: [],
      averageConfidence: 0,
    };
  }

  const entityTypes = [...new Set(rules.map(r => r.entityType))];
  const avgConfidence = rules.reduce((sum, r) => sum + r.confidence, 0) / rules.length;

  return {
    totalRules: rules.length,
    entityTypeCoverage: entityTypes,
    averageConfidence: Math.round(avgConfidence * 100) / 100,
  };
}
