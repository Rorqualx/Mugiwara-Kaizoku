/**
 * MetadataProvenance Component
 *
 * Shows which metadata provider supplied a specific field value.
 * Displays a small badge or icon indicating the source.
 *
 * @module components/manga/MetadataProvenance
 *
 * @deprecated Import from './MetadataProvenance' directory instead
 */

// Re-export all from the decomposed module for backwards compatibility
export {
  MetadataProvenance,
  ProvenanceIndicator,
  useFieldProvenance
} from './MetadataProvenance/index';

export type {
  MetadataProvenanceProps,
  ProvenanceIndicatorProps
} from './MetadataProvenance/index';
