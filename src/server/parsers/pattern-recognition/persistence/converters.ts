/**
 * Database Pattern Converters
 *
 * Type-safe conversion utilities between database records and
 * internal Pattern/Feature types.
 *
 * Extracted from: DatabasePatternStore.ts (lines 486-643)
 */

import type {
  Pattern,
  PatternFeatures,
  FeatureVector,
  PatternCategory,
} from '../types';
import type { Prisma } from '@prisma/client';

/**
 * Convert value to Prisma JsonValue type-safely
 *
 * This helper eliminates the need for inline `as Prisma.JsonValue` casts
 * throughout the codebase, providing a single point of type conversion.
 */
export function toPrismaJson<T>(value: T): Prisma.JsonValue {
  return value as unknown as Prisma.JsonValue;
}

/**
 * Convert database pattern record to internal Pattern type
 *
 * Handles type casting and property mapping from database schema
 * to internal Pattern representation. Maps variations array and
 * reconstructs pattern features from stored feature vectors.
 *
 * @param dbPattern - Raw database pattern record
 * @returns Converted Pattern object
 */
export function dbPatternToPattern(dbPattern: unknown): Pattern {
  const dbp = dbPattern as Record<string, unknown>;

  // Cast to Record to handle extended properties
  const pattern = {} as Record<string, unknown>;

  pattern["id"] = dbp["id"];
  pattern["type"] = dbp["category"] as PatternCategory;

  const selectors = dbp["selectors"] as string[] | undefined;
  pattern["selector"] = selectors?.[0] ?? '';

  pattern["features"] = vectorToPatternFeatures(dbp["featureVector"] as number[]);
  pattern["confidence"] = dbp["confidence"];
  pattern["accuracy"] = dbp["accuracy"];
  pattern["usageCount"] = dbp["usageCount"];
  pattern["lastUsed"] = dbp["lastSeen"];
  pattern["metadata"] = dbp["metadata"] ?? {};

  // Add extended properties
  pattern["category"] = dbp["category"];
  pattern["signature"] = dbp["signature"];
  pattern["selectors"] = dbp["selectors"];
  pattern["successCount"] = dbp["successCount"];
  pattern["failureCount"] = dbp["failureCount"];
  pattern["lastSeen"] = dbp["lastSeen"];
  pattern["version"] = dbp["version"];
  pattern["source"] = dbp["sourceUrls"];

  // Map variations with proper type handling
  const variations = dbp["variations"] as unknown[] | undefined;
  if (variations) {
    pattern["variations"] = variations.map((v: unknown) => {
      const vr = v as Record<string, unknown>;
      const vSelectors = vr["selectors"] as string[] | undefined;
      return {
        id: vr["id"],
        patternId: dbp["id"],
        selector: vSelectors?.[0] ?? '',
        confidence: (vr["successRate"] as number | undefined) ?? 0.5,
        usageCount: (vr["occurrenceCount"] as number | undefined) ?? 0
      };
    });
  }

  return pattern as unknown as Pattern;
}

/**
 * Convert pattern features to feature vector (number array)
 *
 * Transforms PatternFeatures object into a flat number array suitable
 * for ML operations and database storage. If input is already a number
 * array (FeatureVector), returns it unchanged.
 *
 * Vector layout:
 * - [0-3]: Structural features (domDepth, siblingCount, childCount, position)
 * - [4-7]: Semantic features (textLength, wordCount, hasNumbers, hasDate)
 * - [8-11]: Statistical features (entropy, textDensity, numericDensity, punctuationDensity)
 *
 * @param features - PatternFeatures object or existing FeatureVector
 * @returns Number array representation of features
 */
export function patternFeaturesToVector(
  features: PatternFeatures | FeatureVector
): number[] {
  // If it's already a number array (FeatureVector), return it
  if (Array.isArray(features)) {
    return features;
  }

  // Convert PatternFeatures to number array
  const arr: number[] = [];
  const pf = features as PatternFeatures;

  // Add structural features as numbers
  // Note: structural is required in PatternFeatures type, so no null check needed
  arr.push(
    pf.structural.domDepth ?? 0,
    pf.structural.siblingCount ?? 0,
    pf.structural.childCount ?? 0,
    pf.structural.position ?? 0
  );

  // Add semantic features as numbers
  // Note: semantic is required in PatternFeatures type, so no null check needed
  arr.push(
    pf.semantic.textLength ?? 0,
    pf.semantic.wordCount ?? 0,
    pf.semantic.hasNumbers ? 1 : 0,
    pf.semantic.hasDate ? 1 : 0
  );

  // Add statistical features
  // Note: statistical is required in PatternFeatures type, so no null check needed
  arr.push(
    pf.statistical.entropy ?? 0,
    pf.statistical.textDensity ?? 0,
    pf.statistical.numericDensity ?? 0,
    pf.statistical.punctuationDensity ?? 0
  );

  return arr;
}

/**
 * Convert feature vector back to pattern features
 *
 * Reconstructs PatternFeatures object from a flat number array.
 * This is a simplified reconstruction that creates a valid PatternFeatures
 * object with all required fields populated.
 *
 * Note: Some fields are reconstructed with default values as the vector
 * format doesn't preserve all structural information (e.g., domPath, classList).
 * In production, consider storing the full structure separately if needed.
 *
 * @param arr - Feature vector (number array)
 * @returns Reconstructed PatternFeatures object
 */
export function vectorToPatternFeatures(arr: number[]): PatternFeatures {
  // Convert number array back to PatternFeatures structure
  // This is a simplified reconstruction - in production you'd store the full structure
  return {
    structural: {
      domDepth: arr[0] ?? 0,
      domPath: [],
      siblingCount: arr[1] ?? 0,
      childCount: arr[2] ?? 0,
      parentTag: '',
      tagName: '',
      classList: [],
      attributes: {},
      position: arr[3] ?? 0,
      xPath: '',
      cssSelector: '',
      // Add missing required fields
      tagCounts: {},
      maxDepth: arr[0] ?? 0,
      averageDepth: arr[0] ?? 0,
      elementCount: 0
    },
    semantic: {
      textContent: '',
      textLength: arr[4] ?? 0,
      wordCount: arr[5] ?? 0,
      hasNumbers: (arr[6] ?? 0) === 1,
      hasDate: (arr[7] ?? 0) === 1,
      hasISBN: false,
      // Add missing required fields
      embeddings: [],
      sentiment: 0,
      uniqueWords: 0,
      avgWordLength: 0,
      keywordDensity: {},
      topicDistribution: [],
      sentimentScore: 0,
      readabilityScore: 0.5
    },
    statistical: {
      entropy: arr[8] ?? 0,
      textDensity: arr[9] ?? 0,
      numericDensity: arr[10] ?? 0,
      punctuationDensity: arr[11] ?? 0,
      capitalLetterRatio: 0,
      averageWordLength: 0,
      uniqueWordRatio: 0,
      patternScore: 0,
      // Add required fields from StatisticalFeatures type
      wordCount: 0,
      avgWordLength: 0,
      sentenceCount: 0,
      avgSentenceLength: 0,
      paragraphCount: 0
    },
    visual: {
      isVisible: true,
      isAboveFold: false
    },
    contextual: {
      nearbyText: []
    }
  } as unknown as PatternFeatures;
}
