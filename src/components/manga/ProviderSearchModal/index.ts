/**
 * Provider Search Modal exports
 */

export { ProviderSearchModal, } from './ProviderSearchModal';
export { FieldSelectionTab, } from './FieldSelectionTab';
export { PreviewTab, } from './PreviewTab';
export { VolumeChapterPreviewTab, } from './VolumeChapterPreviewTab';
export { useProviderSearch, createFieldSelectionHandler } from './useProviderSearch';
export {
  METADATA_FIELDS,
  VOLUME_SOURCE_FIELDS,
  CHAPTER_SOURCE_FIELDS,
  SOURCE_PREFERENCE_KEYS,
  PROVIDER_LIST,
  collectAllExternalLinks,
  formatValue,
  getProviderColor,
  formatProviderLabel,
  isRecord,
  calculateProviderScore,
  autoSelectBestValues,
  normalizeProviderResult,
} from './utils';
export type {
  ProviderSearchModalProps,
  ProviderBindings,
  SearchResult,
  FieldSelection,
  MetadataFieldConfig,
  ProviderSearchState,
  ProviderOption,
  VolumePreviewChapter,
  VolumePreviewItem,
  ProviderVolumePreview,
} from './types';
