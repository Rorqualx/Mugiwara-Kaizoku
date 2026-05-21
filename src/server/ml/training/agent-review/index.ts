/**
 * Agent Review Module
 *
 * LLM-based label verification workflow for training data.
 * Validates auto-labeled pages, identifies errors, and corrects/adds missing labels.
 */

// Export types
export type {
  AgentReviewResult,
  AgentCorrections,
  LabelCorrection,
  AgentIssues,
  ReviewIssue,
  AgentIssueType,
  PageType,
  DiscoveredUrl,
  BatchReviewOptions,
  BatchReviewResult,
  EntityValidationRule,
  ValidationContext,
  ValidationResult,
  ReviewQueueItem,
  ReviewQueueStats,
  ReviewableToken,
  LabeledSpan,
} from './types';

export { DEFAULT_BATCH_OPTIONS } from './types';

// Export validation
export {
  VALIDATION_RULES,
  validateEntity,
  getCriticalEntitiesForPageType,
  CRITICAL_ENTITIES_SERIES,
  CRITICAL_ENTITIES_VOLUME,
  CRITICAL_ENTITIES_CHAPTER,
} from './validation-rules';

// Export core functions
export { detectPageType } from './page-type-detector';
export { reviewPage, applyCorrections } from './review-logic';
export { generateCorrections, buildBIOLabels } from './correction-generator';
export { discoverRelatedUrls } from './url-discovery';

// Export batch processing
export {
  processAgentReviewBatch,
  getPendingReviewPages,
  getReviewQueueStats,
  queueDiscoveredUrls,
} from './batch-processor';

// Export prompts
export {
  buildSystemPrompt,
  buildReviewPrompt,
  parseReviewResponse,
} from './prompts';
