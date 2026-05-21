/**
 * Pattern Learning Module Index
 *
 * Main entry point for all pattern learning functionality.
 * Exports all decomposed modules for easy consumption.
 */

// Export all hooks
export { 
  usePatternLearningMetrics,
  usePatternSuggestions,
  usePatternConfidence
} from './queries';
export { 
  useSubmitFeedback,
  useSubmitCorrection,
  useTriggerTraining,
  useResetPatterns,
  useExportPatterns,
  useImportPatterns
} from './mutations';
export { 
  usePatternLearningWebSocket,
  usePatternTrainingProgress,
  usePatternSuggestionUpdates,
  usePatternConfidenceUpdates
} from './websocket';

// Export all helper functions
export {
  calculateConfidenceScore,
  calculateFieldMatchScore,
  filterSuggestionsByConfidence,
  groupSuggestionsByField,
  mergeDataWithCorrections,
  extractFieldValuesForAnalysis,
  normalizeFieldValue,
  validatePatternLearningConfig,
  validateCorrectionsWithDetails,
  createDebouncedFunction,
  batchProcessCorrections,
  optimizePatternData,
  formatPatternDataForExport,
  parseImportedPatternData
} from './helpers';

// Export all types and utilities
export type {
  ExtractedData,
  PatternSuggestion,
  WebSocketMessage
} from './utils';
export {
  validateCorrections,
  processWebSocketMessage
} from './utils';

// Export main hook
export { usePatternLearning } from '../usePatternLearning';
