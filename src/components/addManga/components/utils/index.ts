/**
 * Utility Functions Export
 * 
 * Shared utilities for the Add Manga workflow
 */

export {
  getChaptersForVolumes,
  getVolumesForChapters,
  handleVolumeSelection,
  fetchChapterCoversInBatches,
  extractChapterNumbers,
  groupChaptersByVolume
} from './selection-sync';

export {
  mapProviderStatus,
  getEnhancedMetadataField,
  generateFieldSelectorLabel
} from './metadata-helpers';