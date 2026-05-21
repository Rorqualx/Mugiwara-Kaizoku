/**
 * A/B Testing Framework - Module Exports
 *
 * Barrel file for all A/B testing modules.
 */

// Type definitions
export type {
  TestCase,
  TestResult,
  ExperimentConfig,
  ExperimentResults,
  VariantResults
} from './types';

export { handleError, isRecord } from './types';

// Variant analyzer
export {
  shouldUseMLVariant,
  initializeVariantResults,
  updateVariantResults,
  calculateStatisticalSignificance,
  generateRecommendations
} from './variant-analyzer';
