/**
 * Queue Management Utilities
 *
 * Manages learning queue size, diversity selection, and sampling
 * for the Active Learning System.
 *
 * Extracted from: ActiveLearningSystem.ts (lines 191-258)
 */

import type { LearningExample } from '@/server/parsers/pattern-recognition/types';

/**
 * Manage learning queue size by removing oldest examples
 * and maintaining diversity
 */
export function manageLearningQueue(
  learningExamples: LearningExample[],
  uncertainExamples: LearningExample[],
  maxExamples: number
): {
  learningExamples: LearningExample[];
  uncertainExamples: LearningExample[];
} {
  let updatedLearning = learningExamples;
  let updatedUncertain = uncertainExamples;

  // Remove oldest examples if queue is too large
  if (learningExamples.length > maxExamples) {
    // Keep diverse examples
    const diverse = selectDiverseExamples(
      learningExamples,
      Math.floor(maxExamples * 0.8)
    );
    updatedLearning = diverse;
  }

  // Limit uncertain examples
  if (uncertainExamples.length > Math.floor(maxExamples * 0.2)) {
    updatedUncertain = uncertainExamples.slice(-Math.floor(maxExamples * 0.2));
  }

  return {
    learningExamples: updatedLearning,
    uncertainExamples: updatedUncertain
  };
}

/**
 * Select diverse examples for training
 */
export function selectDiverseExamples(
  examples: LearningExample[],
  targetCount: number
): LearningExample[] {
  if (examples.length <= targetCount) {
    return examples;
  }

  const selected: LearningExample[] = [];
  const remaining = [...examples];

  // Ensure we have examples from each label
  const byLabel = new Map<string, LearningExample[]>();
  for (const example of examples) {
    if (!byLabel.has(example.label)) {
      byLabel.set(example.label, []);
    }
    const labelExamples = byLabel.get(example.label);
    if (labelExamples !== undefined) {
      labelExamples.push(example);
    }
  }

  // Take proportional samples from each label
  const samplesPerLabel = Math.floor(targetCount / byLabel.size);
  for (const [_label, labelExamples] of Array.from(byLabel.entries())) {
    const samples = randomSample(labelExamples, samplesPerLabel);
    selected.push(...samples);
  }

  // Fill remaining slots with recent examples
  const recentCount = targetCount - selected.length;
  if (recentCount > 0) {
    const recent = remaining
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, recentCount);
    selected.push(...recent);
  }

  return selected;
}

/**
 * Random sample from array
 */
export function randomSample<T>(array: T[], count: number): T[] {
  const shuffled = [...array].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, array.length));
}
