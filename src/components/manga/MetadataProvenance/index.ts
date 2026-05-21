/**
 * MetadataProvenance Module
 *
 * Components and utilities for displaying metadata provenance information.
 *
 * @module components/manga/MetadataProvenance
 */

// Main component
export { MetadataProvenance } from './MetadataProvenance';

// Sub-components
export { BlockProvenance } from './BlockProvenance';
export { InlineProvenance } from './InlineProvenance';
export { ProviderBadge } from './ProviderBadge';
export { ProvenanceIndicator } from './ProvenanceIndicator';
export { FieldProvenanceBadge } from './FieldProvenanceBadge';
export { MetadataProvenanceSummary } from './MetadataProvenanceSummary';

// Hook
export { useFieldProvenance } from './useFieldProvenance';

// Types
export type {
  BaseProvenanceProps,
  MetadataProvenanceProps,
  ParsedProviders,
  ProviderBadgeProps,
  ProviderData,
  ProvenanceIndicatorProps,
  EnhancedProviderData
} from './types';

// Component-specific types
export type { FieldProvenanceBadgeProps } from './FieldProvenanceBadge';
export type { MetadataProvenanceSummaryProps } from './MetadataProvenanceSummary';

// Utilities
export {
  formatBlockTooltipLabel,
  formatInlineTooltipLabel,
  getProviderColor,
  getProviderData,
  getProviderLabel,
  parseProviders,
  PROVIDER_COLORS,
  PROVIDER_LABELS,
  getConfidenceColor,
  getConfidenceLabel
} from './utils';
