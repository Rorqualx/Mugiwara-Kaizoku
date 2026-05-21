/**
 * MetadataProvenance Component
 *
 * Shows which metadata provider supplied a specific field value.
 * Displays a small badge or icon indicating the source.
 *
 * @module components/manga/MetadataProvenance/MetadataProvenance
 */

import React from 'react';

import { BlockProvenance } from './BlockProvenance';
import { InlineProvenance } from './InlineProvenance';

import type { MetadataProvenanceProps } from './types';

/**
 * Main MetadataProvenance component
 *
 * Delegates to InlineProvenance or BlockProvenance based on the inline prop.
 */
export function MetadataProvenance({
  field,
  provenance,
  enhancedProvenance,
  showConfidence = false,
  inline = true,
  label,
  value,
  size = 'xs'
}: MetadataProvenanceProps): React.ReactElement {
  const sharedProps = {
    field,
    provenance,
    enhancedProvenance,
    showConfidence,
    label,
    value,
    size
  };

  if (inline) {
    return <InlineProvenance {...sharedProps} />;
  }

  return <BlockProvenance {...sharedProps} />;
}
