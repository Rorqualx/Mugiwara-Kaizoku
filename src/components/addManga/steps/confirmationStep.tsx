/**
 * ConfirmationStep Component - Consolidated Version
 * 
 * This file now exports the refactored ConfirmationStep component
 * that uses extracted hooks and components for better maintainability.
 * 
 * The original monolithic component (7591 lines) has been split into:
 * - hooks/ - State management and business logic
 * - components/ - UI components
 * 
 * @module components/addManga/steps/confirmationStep
 */

// Re-export the consolidated component from the index file
export { 
  ConfirmationStep,
  ConfirmationStepStandardized,
  default 
} from './confirmationStep/index';

// Also re-export hooks for external use if needed
export { useConfirmationState } from './confirmationStep/hooks/useConfirmationState';
export { useFieldSelections } from './confirmationStep/hooks/useFieldSelections';
export { useProviderSearch } from './confirmationStep/hooks/useProviderSearch';

// Re-export types
export type {
  ProviderResults,
  DownloadConfig,
  MonitoringConfig,
  ParsedVolumeData
} from './confirmationStep/hooks/useConfirmationState';

export type {
  FieldSelection,
  FieldSelections
} from './confirmationStep/hooks/useFieldSelections';