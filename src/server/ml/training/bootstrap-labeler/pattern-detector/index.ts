/**
 * Pattern Detection Module for Bootstrap Labeling
 *
 * Detects structural patterns in HTML that indicate entity-value relationships:
 * - Label:Value patterns (e.g., "Author: John Smith")
 * - Table header-value relationships
 * - Infobox label-value pairs
 * - Definition list patterns (dt/dd)
 *
 * These patterns provide confidence boosts for token labeling.
 * Supports provider-specific overrides for Wikipedia, Fandom, etc.
 */

import type { EntityType } from '@/server/ml/features/bio-types';
import type { LinearizedToken, LinearizationResult } from '@/server/ml/features/dom-linearizer';
import { logger } from '@/utils/logger';

// Local imports
// Chapter detection handled by source-specific positional rules (wikipedia-rules, fandom-rules)
// detectChapterReferencePatterns causes false positives in prose (matches reference numbers like [1])
import {
  detectDefinitionListPatterns,
  detectInfoboxPatterns,
  detectLabelColonValuePatterns,
  detectSectionHeaderPatterns,
  detectTableHeaderPatterns,
} from './detectors';
// DISABLED: Wikipedia table detector has swapped column mapping (ISBN↔dates)
// TODO: Fix label-mapping.ts or wikipedia-table-detector.ts before re-enabling
// import { detectTableHeaderPatternsWithOverrides } from './provider-overrides/wikipedia-table-detector';

import type { PatternDetectionResult, PatternSignal } from './types';

/** Source type alias from LinearizationResult */
type SourceType = LinearizationResult['sourceType'];

// Re-export types
export type { PatternDetectionResult, PatternSignal, PatternType } from './types';
export { PATTERN_CONFIDENCE_BOOSTS } from './types';
export { LABEL_TO_ENTITY } from './label-mapping';

// ============================================================================
// Main Pattern Detection Function
// ============================================================================

/**
 * Detect patterns in tokens with optional provider-specific overrides.
 *
 * @param tokens - Linearized tokens from the page
 * @param sourceType - Source type for provider-specific overrides (optional)
 * @returns Pattern detection result with patterns and confidence boosts
 */
export function detectPatterns(
  tokens: LinearizedToken[],
  sourceType: SourceType = 'unknown'
): PatternDetectionResult {
  const patterns: PatternSignal[] = [];
  const tokenConfidenceBoosts = new Map<
    number,
    Array<{ entityType: EntityType; boost: number }>
  >();

  patterns.push(...detectLabelColonValuePatterns(tokens));

  // Use provider-specific table header detection for Wikipedia
  if (sourceType === 'wikipedia') {
    // DISABLED: Wikipedia table detector has swapped column mapping (ISBN↔dates)
    // TODO: Fix label-mapping.ts or wikipedia-table-detector.ts before re-enabling
    logger.info('[PATTERN-DETECTOR-DEBUG] Wikipedia table detector DISABLED for verification', { sourceType });
    // const wikiPatterns = detectTableHeaderPatternsWithOverrides(tokens, sourceType);
    // patterns.push(...wikiPatterns);
  } else {
    logger.debug('[PATTERN-DETECTOR-DEBUG] Using standard table detector', { sourceType });
    patterns.push(...detectTableHeaderPatterns(tokens));
  }

  patterns.push(...detectInfoboxPatterns(tokens));
  patterns.push(...detectDefinitionListPatterns(tokens));
  // Chapter detection handled by source-specific positional rules, not generic patterns
  patterns.push(...detectSectionHeaderPatterns(tokens));

  buildConfidenceBoostMap(patterns, tokenConfidenceBoosts);

  return { patterns, tokenConfidenceBoosts };
}

function buildConfidenceBoostMap(
  patterns: PatternSignal[],
  boostMap: Map<number, Array<{ entityType: EntityType; boost: number }>>
): void {
  for (const pattern of patterns) {
    if (!pattern.entityType) continue;
    addPatternBoosts(pattern, boostMap);
  }
}

function addPatternBoosts(
  pattern: PatternSignal,
  boostMap: Map<number, Array<{ entityType: EntityType; boost: number }>>
): void {
  const entityType = pattern.entityType;
  if (!entityType) return;

  for (const tokenIdx of pattern.valueTokenIndices) {
    const existing = boostMap.get(tokenIdx) ?? [];
    existing.push({ entityType, boost: pattern.confidence });
    boostMap.set(tokenIdx, existing);
  }
}

// ============================================================================
// Confidence Boosting Utilities
// ============================================================================

export function boostConfidenceWithPatterns(
  baseConfidence: number,
  tokenIndex: number,
  entityType: EntityType,
  patternResult: PatternDetectionResult
): number {
  const boosts = patternResult.tokenConfidenceBoosts.get(tokenIndex) ?? [];
  let totalBoost = 0;

  for (const boost of boosts) {
    if (boost.entityType === entityType) totalBoost += boost.boost;
  }

  return Math.min(1.0, baseConfidence + totalBoost);
}

export function hasPatternSignal(
  tokenIndex: number,
  entityType: EntityType,
  patternResult: PatternDetectionResult
): boolean {
  const boosts = patternResult.tokenConfidenceBoosts.get(tokenIndex) ?? [];
  return boosts.some((b) => b.entityType === entityType);
}

export function getPatternSignalsForToken(
  tokenIndex: number,
  patternResult: PatternDetectionResult
): PatternSignal[] {
  return patternResult.patterns.filter((p) => p.valueTokenIndices.includes(tokenIndex));
}
