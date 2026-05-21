/**
 * Metrics Calculator
 *
 * Calculates precision, recall, and F1 scores for entity extraction accuracy.
 * Provides entity-level and aggregate metrics.
 *
 * @module auto-labeling/metrics
 */

import type { EntityType } from '@/server/ml/features/dom-linearizer';

import { calculateSimilarity } from './ground-truth';

import type {
  ExtractedEntity,
  ExpectedEntity,
  LabelingMetrics,
  EntityTypeMetrics,
  EntityMatch,
  AggregatedMetrics,
  LabelingAttempt,
} from './types';

// ============================================================================
// Types
// ============================================================================

/**
 * Match configuration options.
 */
export interface MatchConfig {
  /** Minimum similarity for fuzzy match */
  minSimilarity: number;
  /** Whether to allow partial matches */
  allowPartial: boolean;
  /** Partial match similarity threshold */
  partialThreshold: number;
}

const DEFAULT_MATCH_CONFIG: MatchConfig = {
  minSimilarity: 0.8,
  allowPartial: true,
  partialThreshold: 0.6,
};

/**
 * Cross-matchable entity type groups.
 * Types within the same group can match each other.
 */
const CROSS_MATCHABLE_TYPES: EntityType[][] = [
  ['TITLE', 'ALT_TITLE'], // Allow TITLE ↔ ALT_TITLE matching
  ['AUTHOR', 'ARTIST'], // Allow AUTHOR ↔ ARTIST matching (many wikis don't distinguish)
];

/**
 * Entity types that need lower similarity thresholds.
 * Different entity types have different matching challenges:
 * - SUMMARY: Synopses are paraphrased differently across sources
 * - AUTHOR/ARTIST: Name order variations ("Oda, Eiichiro" vs "Eiichiro Oda")
 * - STATUS: Abbreviated forms ("On Hiatus" vs "Hiatus")
 * - RELEASE_DATE: Year approximation, different precision
 * - TITLE/ALT_TITLE: Minor formatting differences, subtitle variations
 */
const RELAXED_SIMILARITY_TYPES: Partial<Record<EntityType, number>> = {
  SERIES_SUMMARY: 0.3, // Very low - just check if topics overlap
  AUTHOR: 0.7,        // Name order variations (LastName, FirstName vs FirstName LastName)
  ARTIST: 0.7,        // Same as AUTHOR - name order variations
  STATUS: 0.6,        // Abbreviated forms ("On Hiatus" vs "Hiatus", "Ongoing" vs "Running")
  RELEASE_DATE: 0.6,  // Year approximation, different date formats
  TITLE: 0.65,        // Subtitle variations ("Title" vs "Title: Subtitle"), series numbering
  ALT_TITLE: 0.6,     // Alternative title variations, romanization differences, translations
};

/**
 * Check if two entity types are compatible for matching.
 * Same type always matches; cross-matchable types also match.
 */
function areTypesCompatible(type1: EntityType, type2: EntityType): boolean {
  if (type1 === type2) return true;

  // Check cross-matchable groups
  for (const group of CROSS_MATCHABLE_TYPES) {
    if (group.includes(type1) && group.includes(type2)) {
      return true;
    }
  }

  return false;
}

/**
 * Get the effective similarity threshold for an entity type.
 */
function getEffectiveSimilarity(entityType: EntityType, config: MatchConfig): number {
  return RELAXED_SIMILARITY_TYPES[entityType] ?? config.minSimilarity;
}

// ============================================================================
// Main Metrics Calculation
// ============================================================================

/**
 * Calculate metrics for a single labeling attempt.
 */
export function calculateMetrics(
  extracted: ExtractedEntity[],
  expected: ExpectedEntity[],
  config?: Partial<MatchConfig>
): LabelingMetrics {
  const cfg = { ...DEFAULT_MATCH_CONFIG, ...config };

  // Match entities
  const { matches, unmatchedExtracted, unmatchedExpected } = matchEntities(extracted, expected, cfg);

  // Calculate counts
  const truePositives = matches.length;
  const falsePositives = unmatchedExtracted.length;
  const falseNegatives = unmatchedExpected.length;

  // Calculate overall P/R/F1
  const precision = calculatePrecision(truePositives, falsePositives);
  const recall = calculateRecall(truePositives, falseNegatives);
  const f1 = calculateF1(precision, recall);

  // Calculate per-entity-type metrics
  const byEntityType = computeEntityBreakdown(matches, unmatchedExtracted, unmatchedExpected);

  return {
    truePositives,
    falsePositives,
    falseNegatives,
    precision,
    recall,
    f1,
    byEntityType,
    matches,
    unmatchedExtracted,
    unmatchedExpected,
  };
}

/**
 * Calculate precision: TP / (TP + FP)
 */
function calculatePrecision(tp: number, fp: number): number {
  const total = tp + fp;
  return total > 0 ? tp / total : 0;
}

/**
 * Calculate recall: TP / (TP + FN)
 */
function calculateRecall(tp: number, fn: number): number {
  const total = tp + fn;
  return total > 0 ? tp / total : 0;
}

/**
 * Calculate F1 score: 2 * (P * R) / (P + R)
 */
function calculateF1(precision: number, recall: number): number {
  const sum = precision + recall;
  return sum > 0 ? (2 * precision * recall) / sum : 0;
}

// ============================================================================
// Entity Matching
// ============================================================================

/**
 * Match extracted entities to expected entities.
 * Only evaluates on entity types that appear in the expected set.
 */
export function matchEntities(
  extracted: ExtractedEntity[],
  expected: ExpectedEntity[],
  config: MatchConfig
): {
  matches: EntityMatch[];
  unmatchedExtracted: ExtractedEntity[];
  unmatchedExpected: ExpectedEntity[];
} {
  const matches: EntityMatch[] = [];
  const usedExtracted = new Set<number>();
  const usedExpected = new Set<number>();

  // Build set of expected entity types (including cross-matchable types)
  const expectedTypes = buildExpectedTypeSet(expected);

  // First pass: exact matches (including cross-type matches for compatible types)
  for (let ei = 0; ei < expected.length; ei++) {
    const exp = expected[ei];
    if (!exp) continue;

    const exactMatch = findExactMatch(extracted, exp, usedExtracted);
    if (exactMatch) {
      matches.push({ extracted: exactMatch.entity, expected: exp, similarity: 1.0, matchType: 'exact' });
      usedExtracted.add(exactMatch.index);
      usedExpected.add(ei);
    }
  }

  // Second pass: fuzzy matches
  for (let ei = 0; ei < expected.length; ei++) {
    if (usedExpected.has(ei)) continue;
    const exp = expected[ei];
    if (!exp) continue;

    const fuzzyMatch = findBestFuzzyMatch(extracted, exp, usedExtracted, config);
    if (fuzzyMatch) {
      matches.push(fuzzyMatch.match);
      usedExtracted.add(fuzzyMatch.index);
      usedExpected.add(ei);
    }
  }

  // Collect unmatched - only count false positives for types we have ground truth for
  const unmatchedExtracted = extracted.filter(
    (e, i) => !usedExtracted.has(i) && expectedTypes.has(e.type)
  );
  const unmatchedExpected = expected.filter((_, i) => !usedExpected.has(i));

  return { matches, unmatchedExtracted, unmatchedExpected };
}

/**
 * Find exact match for an expected entity in extracted list.
 */
function findExactMatch(
  extracted: ExtractedEntity[],
  expected: ExpectedEntity,
  usedIndices: Set<number>
): { entity: ExtractedEntity; index: number } | null {
  for (let xi = 0; xi < extracted.length; xi++) {
    if (usedIndices.has(xi)) continue;
    const ext = extracted[xi];
    if (!ext) continue;

    if (areTypesCompatible(ext.type, expected.type) && ext.normalizedValue === expected.normalizedValue) {
      return { entity: ext, index: xi };
    }
  }
  return null;
}

/**
 * Build set of expected entity types including cross-matchable types.
 */
function buildExpectedTypeSet(expected: ExpectedEntity[]): Set<EntityType> {
  const types = new Set<EntityType>();

  for (const entity of expected) {
    types.add(entity.type);
    addCrossMatchableTypes(types, entity.type);
  }

  return types;
}

/**
 * Add cross-matchable types for a given entity type.
 */
function addCrossMatchableTypes(types: Set<EntityType>, entityType: EntityType): void {
  for (const group of CROSS_MATCHABLE_TYPES) {
    if (group.includes(entityType)) {
      group.forEach(t => types.add(t));
    }
  }
}

/**
 * Find best fuzzy match for an expected entity.
 */
function findBestFuzzyMatch(
  extracted: ExtractedEntity[],
  expected: ExpectedEntity,
  usedIndices: Set<number>,
  config: MatchConfig
): { match: EntityMatch; index: number } | null {
  let bestMatch: { match: EntityMatch; index: number } | null = null;
  let bestSimilarity = 0;

  for (let i = 0; i < extracted.length; i++) {
    if (usedIndices.has(i)) continue;
    const ext = extracted[i];
    // Check if types are compatible (same type or cross-matchable like TITLE/ALT_TITLE)
    if (!ext || !areTypesCompatible(ext.type, expected.type)) continue;

    const similarity = calculateSimilarity(ext.normalizedValue, expected.normalizedValue);

    // Use type-specific threshold for entities like SUMMARY that need relaxed matching
    const effectiveThreshold = getEffectiveSimilarity(expected.type, config);

    if (similarity >= effectiveThreshold && similarity > bestSimilarity) {
      bestSimilarity = similarity;
      bestMatch = {
        match: { extracted: ext, expected, similarity, matchType: 'fuzzy' },
        index: i,
      };
    } else if (config.allowPartial && similarity >= config.partialThreshold && similarity > bestSimilarity) {
      bestSimilarity = similarity;
      bestMatch = {
        match: { extracted: ext, expected, similarity, matchType: 'partial' },
        index: i,
      };
    }
  }

  return bestMatch;
}

// ============================================================================
// Entity Type Breakdown
// ============================================================================

/**
 * Compute metrics breakdown by entity type.
 */
export function computeEntityBreakdown(
  matches: EntityMatch[],
  unmatchedExtracted: ExtractedEntity[],
  unmatchedExpected: ExpectedEntity[]
): Record<string, EntityTypeMetrics> {
  const breakdown: Record<string, EntityTypeMetrics> = {};

  // Collect all entity types
  const allTypes = new Set<string>();
  matches.forEach(m => allTypes.add(m.expected.type));
  unmatchedExtracted.forEach(e => allTypes.add(e.type));
  unmatchedExpected.forEach(e => allTypes.add(e.type));

  // Calculate metrics for each type
  for (const entityType of allTypes) {
    const typeMatches = matches.filter(m => m.expected.type === entityType);
    const typeFP = unmatchedExtracted.filter(e => e.type === entityType);
    const typeFN = unmatchedExpected.filter(e => e.type === entityType);

    const tp = typeMatches.length;
    const fp = typeFP.length;
    const fn = typeFN.length;

    const precision = calculatePrecision(tp, fp);
    const recall = calculateRecall(tp, fn);
    const f1 = calculateF1(precision, recall);

    breakdown[entityType] = {
      entityType: entityType as EntityType,
      truePositives: tp,
      falsePositives: fp,
      falseNegatives: fn,
      precision,
      recall,
      f1,
    };
  }

  return breakdown;
}

// ============================================================================
// Aggregate Metrics
// ============================================================================

/**
 * Aggregate metrics across multiple labeling attempts.
 */
export function aggregateMetrics(attempts: LabelingAttempt[]): AggregatedMetrics {
  const successfulAttempts = attempts.filter(a => a.success && a.metrics);

  if (successfulAttempts.length === 0) {
    return createEmptyAggregatedMetrics(attempts.length);
  }

  // Calculate micro-averaged metrics (pooled counts)
  const totals = calculatePooledCounts(successfulAttempts);
  const microPrecision = calculatePrecision(totals.tp, totals.fp);
  const microRecall = calculateRecall(totals.tp, totals.fn);
  const microF1 = calculateF1(microPrecision, microRecall);

  // Calculate macro-averaged metrics (average of per-attempt metrics)
  const macroAverages = calculateMacroAverages(successfulAttempts);

  // Aggregate per-entity-type metrics
  const byEntityType = aggregateEntityTypeMetrics(successfulAttempts);

  return {
    totalAttempts: attempts.length,
    successfulAttempts: successfulAttempts.length,
    avgPrecision: macroAverages.precision,
    avgRecall: macroAverages.recall,
    avgF1: macroAverages.f1,
    microPrecision,
    microRecall,
    microF1,
    byEntityType,
  };
}

/**
 * Create empty aggregated metrics.
 */
function createEmptyAggregatedMetrics(totalAttempts: number): AggregatedMetrics {
  return {
    totalAttempts,
    successfulAttempts: 0,
    avgPrecision: 0,
    avgRecall: 0,
    avgF1: 0,
    microPrecision: 0,
    microRecall: 0,
    microF1: 0,
    byEntityType: {},
  };
}

/**
 * Calculate pooled counts across attempts.
 */
function calculatePooledCounts(attempts: LabelingAttempt[]): { tp: number; fp: number; fn: number } {
  let tp = 0;
  let fp = 0;
  let fn = 0;

  for (const attempt of attempts) {
    if (!attempt.metrics) continue;
    tp += attempt.metrics.truePositives;
    fp += attempt.metrics.falsePositives;
    fn += attempt.metrics.falseNegatives;
  }

  return { tp, fp, fn };
}

/**
 * Calculate macro-averaged metrics.
 */
function calculateMacroAverages(attempts: LabelingAttempt[]): {
  precision: number;
  recall: number;
  f1: number;
} {
  let totalPrecision = 0;
  let totalRecall = 0;
  let totalF1 = 0;

  for (const attempt of attempts) {
    if (!attempt.metrics) continue;
    totalPrecision += attempt.metrics.precision;
    totalRecall += attempt.metrics.recall;
    totalF1 += attempt.metrics.f1;
  }

  const count = attempts.length;
  return {
    precision: count > 0 ? totalPrecision / count : 0,
    recall: count > 0 ? totalRecall / count : 0,
    f1: count > 0 ? totalF1 / count : 0,
  };
}

/**
 * Aggregate entity type metrics across attempts.
 */
function aggregateEntityTypeMetrics(
  attempts: LabelingAttempt[]
): Record<string, EntityTypeMetrics> {
  const typeData: Record<string, { tp: number; fp: number; fn: number }> = {};

  // Collect counts by type
  for (const attempt of attempts) {
    if (!attempt.metrics) continue;

    for (const [entityType, metrics] of Object.entries(attempt.metrics.byEntityType)) {
      typeData[entityType] ??= { tp: 0, fp: 0, fn: 0 };
      const data = typeData[entityType];
      data.tp += metrics.truePositives;
      data.fp += metrics.falsePositives;
      data.fn += metrics.falseNegatives;
    }
  }

  // Calculate metrics for each type
  const result: Record<string, EntityTypeMetrics> = {};

  for (const [entityType, counts] of Object.entries(typeData)) {
    const precision = calculatePrecision(counts.tp, counts.fp);
    const recall = calculateRecall(counts.tp, counts.fn);
    const f1 = calculateF1(precision, recall);

    result[entityType] = {
      entityType: entityType as EntityType,
      truePositives: counts.tp,
      falsePositives: counts.fp,
      falseNegatives: counts.fn,
      precision,
      recall,
      f1,
    };
  }

  return result;
}

// ============================================================================
// Metric Formatting
// ============================================================================

/**
 * Format metrics for display.
 */
export function formatMetrics(metrics: LabelingMetrics): string {
  const lines = [
    `Precision: ${(metrics.precision * 100).toFixed(1)}%`,
    `Recall: ${(metrics.recall * 100).toFixed(1)}%`,
    `F1 Score: ${(metrics.f1 * 100).toFixed(1)}%`,
    `True Positives: ${metrics.truePositives}`,
    `False Positives: ${metrics.falsePositives}`,
    `False Negatives: ${metrics.falseNegatives}`,
  ];

  if (Object.keys(metrics.byEntityType).length > 0) {
    lines.push('', 'By Entity Type:');
    for (const [type, typeMetrics] of Object.entries(metrics.byEntityType)) {
      lines.push(`  ${type}: P=${(typeMetrics.precision * 100).toFixed(0)}% R=${(typeMetrics.recall * 100).toFixed(0)}% F1=${(typeMetrics.f1 * 100).toFixed(0)}%`);
    }
  }

  return lines.join('\n');
}

/**
 * Format aggregated metrics for display.
 */
export function formatAggregatedMetrics(metrics: AggregatedMetrics): string {
  const lines = [
    `Total Attempts: ${metrics.totalAttempts}`,
    `Successful: ${metrics.successfulAttempts}`,
    '',
    'Macro-Averaged:',
    `  Precision: ${(metrics.avgPrecision * 100).toFixed(1)}%`,
    `  Recall: ${(metrics.avgRecall * 100).toFixed(1)}%`,
    `  F1 Score: ${(metrics.avgF1 * 100).toFixed(1)}%`,
    '',
    'Micro-Averaged:',
    `  Precision: ${(metrics.microPrecision * 100).toFixed(1)}%`,
    `  Recall: ${(metrics.microRecall * 100).toFixed(1)}%`,
    `  F1 Score: ${(metrics.microF1 * 100).toFixed(1)}%`,
  ];

  return lines.join('\n');
}
