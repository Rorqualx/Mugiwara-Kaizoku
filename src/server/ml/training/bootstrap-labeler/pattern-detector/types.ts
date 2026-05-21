/**
 * Types for Pattern Detection
 */

import type { EntityType } from '@/server/ml/features/bio-types';

export type PatternType =
  | 'label_colon_value'
  | 'table_header_value'
  | 'infobox_pair'
  | 'definition_list'
  | 'chapter_reference';

export interface PatternSignal {
  type: PatternType;
  labelText: string;
  entityType: EntityType | null;
  valueTokenIndices: number[];
  confidence: number;
  source: string; // For debugging: which pattern matched
}

export interface PatternDetectionResult {
  patterns: PatternSignal[];
  tokenConfidenceBoosts: Map<number, Array<{ entityType: EntityType; boost: number }>>;
}

// Confidence boost values for different pattern types
export const PATTERN_CONFIDENCE_BOOSTS: Record<PatternType, number> = {
  label_colon_value: 0.2,
  table_header_value: 0.15,
  infobox_pair: 0.25, // Highest because infoboxes are most reliable
  definition_list: 0.2,
  chapter_reference: 0.18, // Moderate confidence for naming convention patterns
};
