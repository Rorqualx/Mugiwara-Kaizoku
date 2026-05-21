/**
 * Data Preparation Utilities
 *
 * Handles data augmentation, balancing, and training set preparation
 * for the Active Learning System.
 *
 * Extracted from: ActiveLearningSystem.ts (lines 333-443)
 */

import type { LearningExample, PatternFeatures } from '@/server/parsers/pattern-recognition/types';

import { randomSample } from './queue-management';

/**
 * Prepare training data with augmentation and balancing
 */
export function prepareTrainingData(
  learningExamples: LearningExample[],
  uncertainExamples: LearningExample[]
): LearningExample[] {
  const examples = [...learningExamples];

  // Add resolved uncertain examples
  const resolvedUncertain = uncertainExamples.filter(e => e.feedback?.correct);
  examples.push(...resolvedUncertain);

  // Augment data for underrepresented classes
  const augmented = augmentData(examples);

  // Balance dataset
  const balanced = balanceDataset(augmented);

  return balanced;
}

/**
 * Augment training data to improve representation of minority classes
 */
export function augmentData(examples: LearningExample[]): LearningExample[] {
  const augmented = [...examples];

  // Count examples per label
  const labelCounts = new Map<string, number>();
  for (const example of examples) {
    labelCounts.set(example.label, (labelCounts.get(example.label) ?? 0) + 1);
  }

  // Find max count
  const maxCount = Math.max(...Array.from(labelCounts.values()));

  // Augment underrepresented classes
  for (const [label, count] of Array.from(labelCounts.entries())) {
    if (count < maxCount * 0.5) {
      const labelExamples = examples.filter(e => e.label === label);
      const needed = Math.floor(maxCount * 0.5 - count);

      for (let i = 0; i < needed && i < labelExamples.length; i++) {
        const original = labelExamples[i % labelExamples.length];
        if (original !== undefined) {
          const augmentedExample = createAugmentedExample(original);
          augmented.push(augmentedExample);
        }
      }
    }
  }

  return augmented;
}

/**
 * Create augmented example with slight variations in features
 */
export function createAugmentedExample(original: LearningExample): LearningExample {
  const augmented: LearningExample = {
    ...original,
    id: `aug_${original.id}`,
    features: {
      ...original.features,
      structural: {
        ...original.features.structural,
        domDepth: (original.features.structural.domDepth ?? 0) + Math.floor(Math.random() * 3 - 1),
        siblingCount: Math.max(0, (original.features.structural.siblingCount ?? 0) + Math.floor(Math.random() * 3 - 1))
      },
      statistical: {
        ...original.features.statistical,
        entropy: (original.features.statistical.entropy ?? 0) * (0.9 + Math.random() * 0.2),
        patternScore: Math.min(1, (original.features.statistical.patternScore ?? 0) * (0.95 + Math.random() * 0.1))
      }
    }
  };

  return augmented;
}

/**
 * Balance dataset by undersampling majority classes to median count
 */
export function balanceDataset(examples: LearningExample[]): LearningExample[] {
  // Group by label
  const byLabel = new Map<string, LearningExample[]>();
  for (const example of examples) {
    const labelGroup = byLabel.get(example.label);
    if (labelGroup === undefined) {
      byLabel.set(example.label, [example]);
    } else {
      labelGroup.push(example);
    }
  }

  // Find median count
  const counts = Array.from(byLabel.values()).map(arr => arr.length);
  counts.sort((a, b) => a - b);
  const medianCount = counts[Math.floor(counts.length / 2)];

  // Balance by undersampling
  const balanced: LearningExample[] = [];
  if (medianCount !== undefined) {
    for (const [_label, labelExamples] of Array.from(byLabel.entries())) {
      if (labelExamples.length > medianCount * 2) {
        // Undersample majority class
        const sampled = randomSample(labelExamples, medianCount * 2);
        balanced.push(...sampled);
      } else {
        balanced.push(...labelExamples);
      }
    }
  }

  return balanced;
}

/**
 * Training pair for similarity learning
 */
export interface TrainingPair {
  features1: PatternFeatures;
  features2: PatternFeatures;
  similar: boolean;
}

/**
 * Create positive training pairs from examples with the same label
 */
export function createPositivePairs(
  labelExamples: LearningExample[]
): TrainingPair[] {
  const pairs: TrainingPair[] = [];

  for (let i = 0; i < Math.min(10, labelExamples.length - 1); i++) {
    for (let j = i + 1; j < Math.min(i + 5, labelExamples.length); j++) {
      const example1 = labelExamples[i];
      const example2 = labelExamples[j];
      if (example1 !== undefined && example2 !== undefined) {
        pairs.push({
          features1: example1.features,
          features2: example2.features,
          similar: true
        });
      }
    }
  }

  return pairs;
}

/**
 * Create negative training pairs from examples with different labels
 */
export function createNegativePairs(
  label1: string,
  label2: string,
  byLabel: Map<string, LearningExample[]>
): TrainingPair[] {
  const pairs: TrainingPair[] = [];
  const examples1 = byLabel.get(label1);
  const examples2 = byLabel.get(label2);

  if (examples1 === undefined || examples2 === undefined) {
    return pairs;
  }

  for (let k = 0; k < Math.min(5, examples1.length, examples2.length); k++) {
    const example1 = examples1[k];
    const example2 = examples2[k];
    if (example1 !== undefined && example2 !== undefined) {
      pairs.push({
        features1: example1.features,
        features2: example2.features,
        similar: false
      });
    }
  }

  return pairs;
}
