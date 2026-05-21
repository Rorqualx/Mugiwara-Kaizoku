/**
 * Download Scoring Specification Pattern - Core Types
 *
 * Defines the interfaces and enums for the Specification Pattern used
 * to evaluate and score Prowlarr search results for Quick Download.
 */

import type { ProwlarrSearchResult } from '@/types/prowlarr';
import type { QuickDownloadCriteria } from '@/types/quickDownload.types';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/** Whether a rejection is permanent (will never pass) or temporary (may pass later) */
export enum RejectionType {
  PERMANENT = 'permanent',
  TEMPORARY = 'temporary',
}

/** Priority group determines evaluation order and short-circuit behavior */
export enum SpecificationPriority {
  /** Hard rejections — short-circuit on first failure */
  REJECTION = 1,
  /** Soft validations — accumulate penalties */
  VALIDATION = 2,
  /** Positive scoring — accumulate bonuses */
  SCORING = 3,
}

// ---------------------------------------------------------------------------
// Score Breakdown
// ---------------------------------------------------------------------------

/** All possible keys in a score breakdown */
export type ScoreBreakdownKey =
  | 'baseScore'
  | 'formatBonus'
  | 'officialBonus'
  | 'completeBonus'
  | 'volumeBonus'
  | 'seedersBonus'
  | 'recencyBonus'
  | 'languageBonus'
  | 'sizePenalty'
  | 'blocklistPenalty';

/** Breakdown of how a total score was computed */
export interface ScoreBreakdown {
  baseScore: number;
  formatBonus: number;
  officialBonus: number;
  completeBonus: number;
  volumeBonus: number;
  seedersBonus: number;
  recencyBonus: number;
  languageBonus: number;
  sizePenalty: number;
  blocklistPenalty: number;
}

// ---------------------------------------------------------------------------
// Specification interfaces
// ---------------------------------------------------------------------------

/** Result returned by a single specification evaluation */
export interface SpecificationResult {
  accepted: boolean;
  score: number;
  breakdownKey: ScoreBreakdownKey;
  reason?: string;
}

/** A single specification that can evaluate a Prowlarr result */
export interface DownloadSpecification {
  readonly name: string;
  readonly rejectionType: RejectionType;
  readonly priority: SpecificationPriority;
  evaluate(
    result: ProwlarrSearchResult,
    criteria: QuickDownloadCriteria,
  ): SpecificationResult;
}

/** A rejection recorded during evaluation */
export interface SpecificationRejection {
  specName: string;
  rejectionType: RejectionType;
  reason: string;
}

/** Aggregated decision for a single search result */
export interface DownloadDecision {
  accepted: boolean;
  result: ProwlarrSearchResult;
  score: number;
  scoreBreakdown: ScoreBreakdown;
  rejections: SpecificationRejection[];
}

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

/** Regex to detect non-Latin scripts (Cyrillic, Arabic, Thai, Korean, CJK) */
export const NON_LATIN_SCRIPT_RE =
  /[\u0400-\u04FF\u0600-\u06FF\u0E00-\u0E7F\uAC00-\uD7AF\u4E00-\u9FFF]/;
