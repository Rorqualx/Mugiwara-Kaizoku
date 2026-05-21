/**
 * Main Components Export
 * 
 * Central export file for all Add Manga workflow components
 */

// Core components
export { 
  ProviderBadge, 
  ProviderBadgeGroup,
  ErrorBoundary,
  useErrorHandler,
  withErrorBoundary
} from './core';

// Field components
export { FieldSelector, createFieldOptions } from './fields';

// Display components
export { 
  VolumeChapterTable,
  MetadataConfidenceDisplay,
  MetadataQualityBadge,
  MetadataPreview 
} from './display';

// Media gallery components
export {
  BannerGallery,
  ImageGallery,
  VolumeCoversGallery,
  ChapterCoversGallery
} from './media';
export type { VolumeData, ChapterData } from './media';

// Utility functions
export {
  getChaptersForVolumes,
  getVolumesForChapters,
  handleVolumeSelection,
  fetchChapterCoversInBatches,
  extractChapterNumbers,
  groupChaptersByVolume,
  mapProviderStatus,
  getEnhancedMetadataField,
  generateFieldSelectorLabel
} from './utils';

// Performance components
export {
  VirtualList,
  VirtualGrid,
  useVirtualListState,
  LazyLoad,
  lazyWithPreload,
  usePreloadComponents,
  ProgressiveImage,
  ProviderResultSkeleton,
  MetadataFieldSkeleton,
  VolumeTableSkeleton,
  LazyProviderResults,
  LazyVolumeChapterTable,
  LazyMetadataPreview
} from './performance';