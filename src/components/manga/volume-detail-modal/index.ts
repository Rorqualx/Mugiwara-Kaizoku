/**
 * Volume Detail Modal Module Index
 *
 * Re-exports all sub-components, hooks, types, and utilities.
 *
 * Components extracted from VolumeDetailModal.tsx (848 lines -> ~180 lines)
 * to improve maintainability and reduce complexity.
 */

// ============================================================================
// Components
// ============================================================================

export { VolumeDetailsTab } from './VolumeDetailsTab';
export type { VolumeDetailsTabProps } from './VolumeDetailsTab';

export { VolumeChaptersTab } from './VolumeChaptersTab';
export type { VolumeChaptersTabProps } from './VolumeChaptersTab';

export { VolumeSearchTab } from './VolumeSearchTab';

// ============================================================================
// Hooks
// ============================================================================

export {
  useVolumeBookmark,
  useEnabledClients,
  useQuickDownload,
  useProwlarrSearch,
  useDownloadFromProwlarr
} from './volume-detail-modal-hooks';

// ============================================================================
// Types
// ============================================================================

export type {
  SettingsData,
  VolumeData,
  VolumeDetailModalProps,
  SearchResult,
  SortStatus
} from './volume-detail-modal-types';

// ============================================================================
// Utilities
// ============================================================================

export { formatAge, formatDate } from './volume-detail-modal-utils';
