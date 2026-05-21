/**
 * Quick Add Service - Backward Compatibility Wrapper
 *
 * This file re-exports the modular QuickAddService for backward compatibility.
 * The service has been refactored into focused modules under ./quickAddService/
 *
 * @module components/addManga/services/quickAddService
 */

// Re-export the service class and factory functions
export {
  QuickAddService,
  createQuickAddService,
  getQuickAddService
} from './quickAddService/index';

// Re-export types for convenience
export type {
  QuickAddStage,
  QuickAddProgress,
  QuickAddCallbacks,
  FieldProviderPreferences,
  VolumeFieldSources,
  FetchedVolumeData,
  QuickAddServiceDependencies
} from './quickAddService/types';
