/**
 * Download Scoring Specifications - Barrel Export
 *
 * Re-exports all specification implementations grouped by priority.
 */

// Rejection specifications (Priority 1 — short-circuit on failure)
export { BlocklistSpecification } from './rejection/blocklist-specification';
export { ZeroSeedersSpecification } from './rejection/zero-seeders-specification';
export { LanguageRejectSpecification } from './rejection/language-reject-specification';

// Validation specifications (Priority 2 — accumulate penalties)
export { SizeBoundsSpecification } from './validation/size-bounds-specification';
export { MinSeedersSpecification } from './validation/min-seeders-specification';

// Scoring specifications (Priority 3 — accumulate bonuses)
export { BaseScoreSpecification } from './scoring/base-score-specification';
export { FormatBonusSpecification } from './scoring/format-bonus-specification';
export { OfficialBonusSpecification } from './scoring/official-bonus-specification';
export { CompleteBonusSpecification } from './scoring/complete-bonus-specification';
export { VolumeBonusSpecification } from './scoring/volume-bonus-specification';
export { SeedersBonusSpecification } from './scoring/seeders-bonus-specification';
export { RecencyBonusSpecification } from './scoring/recency-bonus-specification';
export { LanguageBonusSpecification } from './scoring/language-bonus-specification';
