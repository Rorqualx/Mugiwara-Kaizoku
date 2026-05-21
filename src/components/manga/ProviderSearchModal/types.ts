/**
 * Types for Provider Search Modal
 */

import type { TablerIconsProps } from '@tabler/icons-react';

/**
 * Map of provider name → bound provider ID.
 * When a provider has a binding, the modal fetches by ID instead of title search.
 */
export type ProviderBindings = Record<string, string>;

export interface ProviderSearchModalProps {
  opened: boolean;
  /** Called when the modal closes. `changed` is true only when metadata was applied. */
  onClose: (changed?: boolean) => void;
  mangaId: number;
  mangaTitle: string;
  currentProvider?: string;
  currentMetadata?: Record<string, unknown> | undefined;
  /** Existing provider bindings (provider → providerId) */
  providerBindings?: ProviderBindings | undefined;
}

export interface SearchResult {
  id: string;
  title: string;
  coverUrl?: string;
  description?: string;
  status?: string;
  author?: string;
  artist?: string;
  publisher?: string;
  startDate?: string;
  endDate?: string;
  chapters?: number;
  volumes?: number;
  score?: number;
  popularity?: number;
  genres?: string[];
  tags?: string[];
  url?: string;
}

export interface FieldSelection {
  field: string;
  provider: string;
  value: unknown;
}

export interface MetadataFieldConfig {
  key: string;
  label: string;
  icon: React.ComponentType<TablerIconsProps>;
}

export interface ProviderSearchState {
  providerData: Record<string, unknown>;
  fieldSelections: Record<string, FieldSelection>;
  isSearching: boolean;
  autoSelectBest: boolean;
}

export interface ProviderOption {
  value: string;
  label: string;
  description: string;
}

export interface VolumePreviewChapter {
  number: string;
  title?: string;
  url?: string;
  releaseDate?: string;
}

export interface VolumePreviewItem {
  volumeNumber: number;
  title?: string;
  summary?: string;
  coverImage?: string;
  chapters: VolumePreviewChapter[];
}

export interface ProviderVolumePreview {
  provider: string;
  volumes: VolumePreviewItem[];
  totalChapters: number;
  error?: string;
}
