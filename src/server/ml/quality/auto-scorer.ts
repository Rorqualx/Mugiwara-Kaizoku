/**
 * Automatic Quality Scorer for LLM Training Data
 *
 * Computes fast automated quality scores to complement IAA metrics.
 * Used for filtering and prioritizing annotation data.
 *
 * @module ml/quality/auto-scorer
 */

import { parseBIOTag, BIO_LABELS } from '../features/bio-types';

import type { BIOTag } from '../features/bio-types';
import type { LinearizedToken } from '../features/dom-linearizer';

// ============================================================================
// Types
// ============================================================================

export interface QualityFactors {
  tokenCount: number;
  wordCount: number;
  labeledRatio: number;
  entityDiversity: number;
  entityCount: number;
  confidenceScore: number;
  structuredContent: number;
  contentRichness: number;
}

export interface AutoQualityResult {
  score: number;
  tier: 'high' | 'medium' | 'low' | 'exclude';
  factors: QualityFactors;
  recommendations: string[];
}

interface ScoringWeights {
  tokenCount: number;
  labeledRatio: number;
  entityDiversity: number;
  confidenceScore: number;
  structuredContent: number;
  contentRichness: number;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_WEIGHTS: ScoringWeights = {
  tokenCount: 0.15,
  labeledRatio: 0.25,
  entityDiversity: 0.20,
  confidenceScore: 0.15,
  structuredContent: 0.10,
  contentRichness: 0.15,
};

const TIER_THRESHOLDS = {
  high: 0.75,
  medium: 0.50,
  low: 0.25,
};

const TOKEN_COUNT_OPTIMAL = { min: 50, max: 2000 };
const ENTITY_COUNT_OPTIMAL_MIN = 3;

// ============================================================================
// Main Scoring Function
// ============================================================================

/**
 * Compute automatic quality score for annotated page data
 */
export function computeAutoQuality(
  tokens: LinearizedToken[],
  labels: BIOTag[],
  confidence?: number,
  weights: Partial<ScoringWeights> = {}
): AutoQualityResult {
  const mergedWeights = { ...DEFAULT_WEIGHTS, ...weights };

  const factors = computeQualityFactors(tokens, labels, confidence);
  const score = computeWeightedScore(factors, mergedWeights);
  const tier = determineTier(score);
  const recommendations = generateRecommendations(factors, tier);

  return { score, tier, factors, recommendations };
}

// ============================================================================
// Factor Computation
// ============================================================================

function computeQualityFactors(
  tokens: LinearizedToken[],
  labels: BIOTag[],
  confidence?: number
): QualityFactors {
  const tokenCount = tokens.length;
  const wordCount = tokens.filter(t => t.tokenType === 'word').length;
  const labeledRatio = computeLabeledRatio(labels);
  const { diversity: entityDiversity, count: entityCount } = computeEntityMetrics(labels);
  const confidenceScore = confidence ?? 0.5;
  const structuredContent = computeStructuredContentScore(tokens);
  const contentRichness = computeContentRichness(tokens);

  return {
    tokenCount,
    wordCount,
    labeledRatio,
    entityDiversity,
    entityCount,
    confidenceScore,
    structuredContent,
    contentRichness,
  };
}

function computeLabeledRatio(labels: BIOTag[]): number {
  if (labels.length === 0) return 0;

  const labeledCount = labels.filter(l => l !== 'O').length;
  return labeledCount / labels.length;
}

function computeEntityMetrics(labels: BIOTag[]): { diversity: number; count: number } {
  const entityTypes = new Set<string>();
  let entityCount = 0;

  for (const label of labels) {
    const parsed = parseBIOTag(label);
    if (parsed?.prefix === 'B') {
      entityTypes.add(parsed.entity);
      entityCount++;
    }
  }

  const totalPossibleEntities = Object.keys(BIO_LABELS).length;
  const diversity = totalPossibleEntities > 0 ? entityTypes.size / totalPossibleEntities : 0;

  return { diversity, count: entityCount };
}

function computeStructuredContentScore(tokens: LinearizedToken[]): number {
  let score = 0;

  const hasInfobox = tokens.some(t => t.isInInfobox);
  const hasTable = tokens.some(t => t.isInTable);
  const hasHeaders = tokens.some(t => t.isHeader);
  const hasList = tokens.some(t => t.isInList);

  if (hasInfobox) score += 0.4;
  if (hasTable) score += 0.3;
  if (hasHeaders) score += 0.2;
  if (hasList) score += 0.1;

  return Math.min(score, 1.0);
}

function computeContentRichness(tokens: LinearizedToken[]): number {
  if (tokens.length === 0) return 0;

  let score = 0;
  const hasImages = tokens.some(t => t.tokenType === 'image');
  const hasLinks = tokens.some(t => t.isLink);
  const hasBold = tokens.some(t => t.isBold);
  const hasItalic = tokens.some(t => t.isItalic);

  if (hasImages) score += 0.3;
  if (hasLinks) score += 0.3;
  if (hasBold || hasItalic) score += 0.2;

  // Token count bonus (more content = richer)
  const countBonus = normalizeTokenCount(tokens.length) * 0.2;
  score += countBonus;

  return Math.min(score, 1.0);
}

// ============================================================================
// Score Computation
// ============================================================================

function computeWeightedScore(factors: QualityFactors, weights: ScoringWeights): number {
  const normalizedFactors = {
    tokenCount: normalizeTokenCount(factors.tokenCount),
    labeledRatio: normalizeLabeledRatio(factors.labeledRatio),
    entityDiversity: factors.entityDiversity,
    confidenceScore: factors.confidenceScore,
    structuredContent: factors.structuredContent,
    contentRichness: factors.contentRichness,
  };

  let score = 0;
  score += normalizedFactors.tokenCount * weights.tokenCount;
  score += normalizedFactors.labeledRatio * weights.labeledRatio;
  score += normalizedFactors.entityDiversity * weights.entityDiversity;
  score += normalizedFactors.confidenceScore * weights.confidenceScore;
  score += normalizedFactors.structuredContent * weights.structuredContent;
  score += normalizedFactors.contentRichness * weights.contentRichness;

  return Math.max(0, Math.min(1, score));
}

function normalizeTokenCount(count: number): number {
  if (count < TOKEN_COUNT_OPTIMAL.min) {
    return count / TOKEN_COUNT_OPTIMAL.min;
  }
  if (count > TOKEN_COUNT_OPTIMAL.max) {
    return Math.max(0.5, 1 - (count - TOKEN_COUNT_OPTIMAL.max) / TOKEN_COUNT_OPTIMAL.max);
  }
  return 1.0;
}

function normalizeLabeledRatio(ratio: number): number {
  // Optimal: 5-30% labeled (too much labeling may indicate over-annotation)
  if (ratio < 0.05) return ratio * 10;
  if (ratio > 0.30) return Math.max(0.5, 1 - (ratio - 0.30) * 2);
  return 1.0;
}

function determineTier(score: number): AutoQualityResult['tier'] {
  if (score >= TIER_THRESHOLDS.high) return 'high';
  if (score >= TIER_THRESHOLDS.medium) return 'medium';
  if (score >= TIER_THRESHOLDS.low) return 'low';
  return 'exclude';
}

// ============================================================================
// Recommendations
// ============================================================================

function generateRecommendations(
  factors: QualityFactors,
  tier: AutoQualityResult['tier']
): string[] {
  const recommendations: string[] = [];

  if (factors.tokenCount < TOKEN_COUNT_OPTIMAL.min) {
    recommendations.push('Page has insufficient content. Consider merging with related pages.');
  }

  if (factors.tokenCount > TOKEN_COUNT_OPTIMAL.max) {
    recommendations.push('Page is very long. Consider splitting into multiple training examples.');
  }

  if (factors.labeledRatio < 0.02) {
    recommendations.push('Very few entities labeled. Review for missed annotations.');
  }

  if (factors.entityCount < ENTITY_COUNT_OPTIMAL_MIN) {
    recommendations.push('Low entity count. May need additional annotation.');
  }

  if (factors.entityDiversity < 0.1) {
    recommendations.push('Low entity type diversity. Consider pages with more varied content.');
  }

  if (factors.structuredContent < 0.2) {
    recommendations.push('Lacks structured content (tables, infoboxes). May reduce extraction quality.');
  }

  if (tier === 'exclude') {
    recommendations.push('Quality too low for training. Consider excluding from dataset.');
  }

  return recommendations;
}

// ============================================================================
// Batch Operations
// ============================================================================

export interface BatchQualityInput {
  id: string;
  tokens: LinearizedToken[];
  labels: BIOTag[];
  confidence?: number;
}

export interface BatchQualityResult {
  results: Map<string, AutoQualityResult>;
  stats: BatchQualityStats;
}

export interface BatchQualityStats {
  total: number;
  byTier: { high: number; medium: number; low: number; exclude: number };
  avgScore: number;
  avgTokenCount: number;
  avgEntityCount: number;
}

/**
 * Compute quality scores for multiple pages
 */
export function computeBatchQuality(
  pages: BatchQualityInput[],
  weights?: Partial<ScoringWeights>
): BatchQualityResult {
  const results = new Map<string, AutoQualityResult>();
  const tierCounts = { high: 0, medium: 0, low: 0, exclude: 0 };
  let totalScore = 0;
  let totalTokens = 0;
  let totalEntities = 0;

  for (const page of pages) {
    const result = computeAutoQuality(page.tokens, page.labels, page.confidence, weights);
    results.set(page.id, result);

    tierCounts[result.tier]++;
    totalScore += result.score;
    totalTokens += result.factors.tokenCount;
    totalEntities += result.factors.entityCount;
  }

  const total = pages.length;
  const stats: BatchQualityStats = {
    total,
    byTier: tierCounts,
    avgScore: total > 0 ? totalScore / total : 0,
    avgTokenCount: total > 0 ? totalTokens / total : 0,
    avgEntityCount: total > 0 ? totalEntities / total : 0,
  };

  return { results, stats };
}

/**
 * Filter pages by minimum quality tier
 */
export function filterByQuality(
  pages: BatchQualityInput[],
  minTier: AutoQualityResult['tier']
): BatchQualityInput[] {
  const tierOrder: Record<AutoQualityResult['tier'], number> = {
    high: 3,
    medium: 2,
    low: 1,
    exclude: 0,
  };

  const minTierValue = tierOrder[minTier];

  return pages.filter(page => {
    const result = computeAutoQuality(page.tokens, page.labels, page.confidence);
    return tierOrder[result.tier] >= minTierValue;
  });
}
