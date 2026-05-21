/**
 * Pattern Learning Mutations Module
 *
 * Data modification operations for pattern learning functionality.
 * Re-exports all mutation hooks from focused modules.
 *
 * Extracted from: usePatternLearning.ts (lines 301-400)
 */

// Re-export individual mutation hooks from external files
export { useSubmitCorrections } from './useSubmitCorrections';
export { useSubmitBatchCorrections } from './useSubmitBatchCorrections';
export { useTrainOnExamples } from './useTrainOnExamples';
export { useUndoLastCorrection } from './useUndoLastCorrection';

// Re-export mutation hooks from decomposed modules
export { useSubmitFeedback } from './mutations/feedback-mutations';
export { useSubmitCorrection } from './mutations/correction-mutations';
export { useTriggerTraining } from './mutations/training-mutations';
export { useResetPatterns } from './mutations/management-mutations';
export { useExportPatterns } from './mutations/management-mutations';
export { useImportPatterns } from './mutations/management-mutations';

// Re-export core mutation functions
export { submitFeedback, submitCorrection, triggerTraining } from './mutations/core-mutations';

// Re-export types for backward compatibility
export type { PatternFeedback, PatternCorrection } from './utils';
