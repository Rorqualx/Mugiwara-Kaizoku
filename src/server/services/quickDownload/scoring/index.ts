/**
 * Download Scoring Module - Barrel Export
 *
 * Re-exports the decision engine, types, and all specifications.
 */

// Engine
export { DownloadDecisionEngine, createDefaultSpecifications } from './engine';

// Types
export type {
  DownloadDecision,
  DownloadSpecification,
  ScoreBreakdown,
  ScoreBreakdownKey,
  SpecificationRejection,
  SpecificationResult,
} from './types';
export {
  NON_LATIN_SCRIPT_RE,
  RejectionType,
  SpecificationPriority,
} from './types';

// Specifications
export {
  BaseScoreSpecification,
  BlocklistSpecification,
  CompleteBonusSpecification,
  FormatBonusSpecification,
  LanguageBonusSpecification,
  LanguageRejectSpecification,
  MinSeedersSpecification,
  OfficialBonusSpecification,
  RecencyBonusSpecification,
  SeedersBonusSpecification,
  SizeBoundsSpecification,
  VolumeBonusSpecification,
  ZeroSeedersSpecification,
} from './specifications';
