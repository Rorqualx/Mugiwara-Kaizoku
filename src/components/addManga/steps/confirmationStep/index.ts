/**
 * Confirmation Step Components and Hooks
 * 
 * This module contains the refactored confirmation step functionality,
 * split from the original 7000+ line component into manageable pieces
 */

// Export the main component
export { ConfirmationStep, ConfirmationStepStandardized, default } from './ConfirmationStep';

// Export hooks
export { useConfirmationState } from './hooks/useConfirmationState';
export type { 
  ProviderResults, 
  DownloadConfig, 
  MonitoringConfig, 
  ParsedVolumeData 
} from './hooks/useConfirmationState';
export { useFieldSelections } from './hooks/useFieldSelections';
export type { FieldSelection, FieldSelections } from './hooks/useFieldSelections';
export { useProviderSearch } from './hooks/useProviderSearch';

// Export components
export { MetadataFieldSelector, BulkFieldSelector } from './components/MetadataFieldSelector';
export { VolumeChapterDisplay } from './components/VolumeChapterDisplay';
export { ProviderTabs } from './components/ProviderTabs';
export { MetadataDisplay } from './components/MetadataDisplay';
export { BannerModal, ChapterPreviewModal } from './components/MediaModals';
