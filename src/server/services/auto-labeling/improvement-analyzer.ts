/**
 * Improvement Analyzer
 *
 * Analyzes failures from labeling attempts to identify patterns
 * and generate actionable improvement suggestions.
 *
 * @module auto-labeling/improvement-analyzer
 */

import type { EntityType } from '@/server/ml/features/bio-types';
import { createLogger } from '@/utils/logger';

import { calculateSimilarity } from './ground-truth';

import type {
  DetailedImprovementSuggestion,
  ExtractedEntity,
  ExpectedEntity,
  IssueType,
  LabelingAttempt,
  SampledPage,
} from './types';

const logger = createLogger('auto-labeling:improvement-analyzer');

// ============================================================================
// Types
// ============================================================================

/**
 * A failure instance detected during analysis.
 */
interface FailureInstance {
  issue: IssueType;
  entityType: EntityType;
  expected: string | null;
  extracted: string | null;
  page: SampledPage;
  similarity?: number;
}

/**
 * A pattern of failures detected across multiple pages.
 */
interface FailurePattern {
  entityType: EntityType;
  issue: IssueType;
  description: string;
  count: number;
  examples: FailureInstance[];
  commonFeatures: string[];
}

// ============================================================================
// Main Analysis Function
// ============================================================================

/**
 * Analyze failures from labeling attempts and generate improvement suggestions.
 */
export function analyzeFailures(attempts: LabelingAttempt[]): DetailedImprovementSuggestion[] {
  logger.info('Analyzing failures', { attemptCount: attempts.length });

  const failures = collectFailureInstances(attempts);
  logger.info('Collected failure instances', { failureCount: failures.length });

  const patterns = identifyPatterns(failures);
  logger.info('Identified patterns', { patternCount: patterns.length });

  const suggestions = patterns.map(pattern => generateSuggestion(pattern));
  suggestions.sort((a, b) => b.impactScore - a.impactScore);

  return suggestions;
}

// ============================================================================
// Failure Collection
// ============================================================================

/**
 * Collect all failure instances from labeling attempts.
 */
function collectFailureInstances(attempts: LabelingAttempt[]): FailureInstance[] {
  const failures: FailureInstance[] = [];

  for (const attempt of attempts) {
    if (!attempt.metrics) continue;
    collectAttemptFailures(attempt, failures);
  }

  return failures;
}

/**
 * Collect failures from a single attempt.
 */
function collectAttemptFailures(attempt: LabelingAttempt, failures: FailureInstance[]): void {
  const { metrics, page, extractedEntities } = attempt;
  if (!metrics) return;

  // Missed entities (false negatives)
  for (const expected of metrics.unmatchedExpected) {
    failures.push({ issue: 'missed', entityType: expected.type, expected: expected.value, extracted: null, page });
  }

  // Noise (false positives)
  for (const extracted of metrics.unmatchedExtracted) {
    failures.push({ issue: 'noise', entityType: extracted.type, expected: null, extracted: extracted.value, page });
  }

  // Wrong values (partial matches)
  for (const match of metrics.matches) {
    if (match.matchType === 'partial' || match.similarity < 0.8) {
      failures.push({
        issue: 'wrong_value',
        entityType: match.expected.type,
        expected: match.expected.value,
        extracted: match.extracted.value,
        page,
        similarity: match.similarity,
      });
    }
  }

  // Low confidence extractions
  for (const extracted of extractedEntities) {
    if (extracted.confidence < 0.6) {
      failures.push({ issue: 'low_confidence', entityType: extracted.type, expected: null, extracted: extracted.value, page });
    }
  }
}

// ============================================================================
// Pattern Identification
// ============================================================================

/**
 * Identify patterns in failure instances.
 */
function identifyPatterns(failures: FailureInstance[]): FailurePattern[] {
  const groups = groupFailuresByTypeAndIssue(failures);
  return convertGroupsToPatterns(groups);
}

/**
 * Group failures by entity type and issue type.
 */
function groupFailuresByTypeAndIssue(failures: FailureInstance[]): Map<string, FailureInstance[]> {
  const groups = new Map<string, FailureInstance[]>();

  for (const failure of failures) {
    const key = `${failure.entityType}:${failure.issue}`;
    const group = groups.get(key);
    if (group) {
      group.push(failure);
    } else {
      groups.set(key, [failure]);
    }
  }

  return groups;
}

/**
 * Convert grouped failures into patterns.
 */
function convertGroupsToPatterns(groups: Map<string, FailureInstance[]>): FailurePattern[] {
  const patterns: FailurePattern[] = [];

  for (const [key, instances] of groups) {
    if (instances.length < 2) continue;

    const [entityType, issue] = key.split(':') as [EntityType, IssueType];
    patterns.push({
      entityType,
      issue,
      description: generatePatternDescription(entityType, issue, instances.length),
      count: instances.length,
      examples: instances.slice(0, 5),
      commonFeatures: identifyCommonFeatures(instances),
    });
  }

  patterns.sort((a, b) => b.count - a.count);
  return patterns;
}

/**
 * Generate a description for a failure pattern.
 */
function generatePatternDescription(entityType: EntityType, issue: IssueType, count: number): string {
  const descriptions: Record<IssueType, string> = {
    missed: `${entityType} was not extracted ${count} times despite being present in ground truth`,
    noise: `${entityType} was incorrectly extracted ${count} times (not in ground truth)`,
    wrong_value: `${entityType} was extracted with incorrect values ${count} times`,
    low_confidence: `${entityType} extractions had low confidence ${count} times`,
  };
  return descriptions[issue];
}

/**
 * Identify common features among failure instances.
 */
function identifyCommonFeatures(instances: FailureInstance[]): string[] {
  const features: string[] = [];
  addDominantSourceFeature(instances, features);
  addDominantPageTypeFeature(instances, features);
  addSimilarityFeature(instances, features);
  return features;
}

function addDominantSourceFeature(instances: FailureInstance[], features: string[]): void {
  const sourceCounts = countByProperty(instances, i => i.page.source);
  const dominant = findDominant(sourceCounts, instances.length);
  if (dominant) features.push(`Mostly occurs on ${dominant} pages`);
}

function addDominantPageTypeFeature(instances: FailureInstance[], features: string[]): void {
  const pageTypeCounts = countByProperty(instances, i => i.page.urlType);
  const dominant = findDominant(pageTypeCounts, instances.length);
  if (dominant) features.push(`Mostly occurs on ${dominant} pages`);
}

function addSimilarityFeature(instances: FailureInstance[], features: string[]): void {
  const wrongValueInstances = instances.filter(i => i.issue === 'wrong_value');
  if (wrongValueInstances.length === 0) return;

  const avgSimilarity = wrongValueInstances.reduce((sum, i) => sum + (i.similarity ?? 0), 0) / wrongValueInstances.length;
  if (avgSimilarity > 0.6) {
    features.push(`Values are partially correct (avg similarity: ${(avgSimilarity * 100).toFixed(0)}%)`);
  }
}

function countByProperty<T>(items: T[], accessor: (item: T) => string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const value = accessor(item);
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

function findDominant(counts: Map<string, number>, total: number): string | null {
  for (const [value, count] of counts) {
    if (count > total * 0.7) return value;
  }
  return null;
}

// ============================================================================
// Suggestion Generation
// ============================================================================

/**
 * Generate an improvement suggestion from a failure pattern.
 */
function generateSuggestion(pattern: FailurePattern): DetailedImprovementSuggestion {
  const { suggestedFix, affectedFiles } = generateFix(pattern);
  return {
    entityType: pattern.entityType,
    issue: pattern.issue,
    pattern: pattern.description,
    suggestedFix,
    examples: pattern.examples.map(e => ({ expected: e.expected ?? '', extracted: e.extracted, page: e.page.url })),
    impactScore: calculateImpactScore(pattern),
    affectedFiles,
  };
}

/**
 * Generate a fix suggestion based on the failure pattern.
 */
function generateFix(pattern: FailurePattern): { suggestedFix: string; affectedFiles: string[] } {
  const fixGenerators: Record<IssueType, (p: FailurePattern) => { suggestedFix: string; affectedFiles: string[] }> = {
    missed: generateMissedFix,
    noise: generateNoiseFix,
    wrong_value: generateWrongValueFix,
    low_confidence: generateLowConfidenceFix,
  };
  return fixGenerators[pattern.issue](pattern);
}

function generateMissedFix(pattern: FailurePattern): { suggestedFix: string; affectedFiles: string[] } {
  const values = pattern.examples.filter(e => e.expected).map(e => e.expected).slice(0, 3);
  const affectedFiles = getAffectedFiles(pattern.entityType);
  const fix = isLabelMappingEntity(pattern.entityType)
    ? `Add label mapping patterns for ${pattern.entityType}. Expected values not found: ${values.join(', ')}`
    : `Enhance extraction rules for ${pattern.entityType}. Check selectors and DOM traversal`;
  return { suggestedFix: fix, affectedFiles };
}

function generateNoiseFix(pattern: FailurePattern): { suggestedFix: string; affectedFiles: string[] } {
  const values = pattern.examples.filter(e => e.extracted).map(e => e.extracted).slice(0, 3);
  return {
    suggestedFix: `Add blacklist patterns to filter false ${pattern.entityType} extractions. Incorrectly extracted: ${values.join(', ')}`,
    affectedFiles: getAffectedFiles(pattern.entityType),
  };
}

function generateWrongValueFix(pattern: FailurePattern): { suggestedFix: string; affectedFiles: string[] } {
  const avgSim = pattern.examples.reduce((s, e) => s + (e.similarity ?? 0), 0) / pattern.examples.length;
  const fix = avgSim > 0.7
    ? `Values are close but need normalization (${(avgSim * 100).toFixed(0)}% similarity). Review text cleaning`
    : `Extraction finding wrong data for ${pattern.entityType}. Review selector specificity`;
  return { suggestedFix: fix, affectedFiles: getAffectedFiles(pattern.entityType) };
}

function generateLowConfidenceFix(pattern: FailurePattern): { suggestedFix: string; affectedFiles: string[] } {
  return {
    suggestedFix: `Adjust confidence threshold for ${pattern.entityType} or improve pattern specificity`,
    affectedFiles: getAffectedFiles(pattern.entityType),
  };
}

function getAffectedFiles(entityType: EntityType): string[] {
  const base = ['src/server/ml/training/bootstrap-labeler/pattern-detector/label-mapping.ts'];
  const specific: Record<string, string[]> = {
    TITLE: ['src/server/services/fandom/fandom/metadata/infobox-parser.ts'],
    AUTHOR: ['src/server/services/fandom/fandom/metadata/infobox-parser.ts'],
    VOLUME_TABLE: ['src/server/services/auto-labeling/parser-bridge/fandom-extractor.ts'],
    CHAPTER_TABLE: ['src/server/services/auto-labeling/parser-bridge/fandom-extractor.ts'],
  };
  return [...base, ...(specific[entityType] ?? [])];
}

function isLabelMappingEntity(entityType: EntityType): boolean {
  return ['AUTHOR', 'ARTIST', 'PUBLISHER', 'MAGAZINE', 'STATUS', 'GENRE', 'DEMOGRAPHIC', 'RELEASE_DATE'].includes(entityType);
}

function calculateImpactScore(pattern: FailurePattern): number {
  const countScore = Math.min(pattern.count / 25, 0.4);
  const issueScore: Record<IssueType, number> = { missed: 0.3, wrong_value: 0.25, noise: 0.2, low_confidence: 0.1 };
  const priorityTypes = ['TITLE', 'AUTHOR', 'STATUS', 'VOLUME_COUNT', 'CHAPTER_COUNT', 'PUBLISHER'];
  const typeScore = priorityTypes.includes(pattern.entityType) ? 0.3 : 0.15;
  return Math.min(countScore + issueScore[pattern.issue] + typeScore, 1.0);
}

// ============================================================================
// Summary & Utilities
// ============================================================================

/**
 * Generate a human-readable summary of improvement suggestions.
 */
export function generateImprovementSummary(suggestions: DetailedImprovementSuggestion[]): string {
  if (suggestions.length === 0) return 'No significant improvement suggestions found.';

  const lines: string[] = ['=' .repeat(70), 'IMPROVEMENT SUGGESTIONS', '='.repeat(70), ''];
  const groups = [
    { label: '🔴 CRITICAL', min: 0.7, items: suggestions.filter(s => s.impactScore >= 0.7) },
    { label: '🟠 HIGH', min: 0.5, items: suggestions.filter(s => s.impactScore >= 0.5 && s.impactScore < 0.7) },
    { label: '🟡 MEDIUM', min: 0.3, items: suggestions.filter(s => s.impactScore >= 0.3 && s.impactScore < 0.5) },
    { label: '🟢 LOW', min: 0, items: suggestions.filter(s => s.impactScore < 0.3) },
  ];

  for (const { label, items } of groups) {
    if (items.length === 0) continue;
    lines.push(`${label} PRIORITY:`);
    for (const s of items) {
      lines.push(`  • [${s.entityType}] ${s.pattern}`);
      if (s.impactScore >= 0.5) lines.push(`    Fix: ${s.suggestedFix}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Check if two values are similar enough to be considered a partial match.
 */
export function isSimilar(a: string, b: string, threshold: number = 0.6): boolean {
  return calculateSimilarity(a, b) >= threshold;
}

/**
 * Find the closest extracted entity for an expected entity.
 */
export function findClosestMatch(
  expected: ExpectedEntity,
  extracted: ExtractedEntity[]
): { entity: ExtractedEntity; similarity: number } | null {
  let best: { entity: ExtractedEntity; similarity: number } | null = null;
  for (const e of extracted) {
    if (e.type !== expected.type) continue;
    const similarity = calculateSimilarity(e.normalizedValue, expected.normalizedValue);
    if (!best || similarity > best.similarity) best = { entity: e, similarity };
  }
  return best;
}
