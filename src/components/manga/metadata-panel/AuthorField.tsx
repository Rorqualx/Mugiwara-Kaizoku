/**
 * Author Field Component
 *
 * Displays manga author information with provenance
 */

import React from 'react';

import { LabeledField } from '@/components/metadata/LabeledField';

import type { MetadataFieldProps } from './types';

/**
 * Extract provider source from provenance field
 */
function getProvenanceSource(field: unknown): string | undefined {
  if (field && typeof field === 'object' && 'source' in field) {
    return String(field.source);
  }
  return undefined;
}

export function AuthorField({ metadata, provenance }: MetadataFieldProps): React.ReactElement | null {
  if (!metadata?.authors || metadata.authors.length === 0) {
    return null;
  }

  const authorProviderId = getProvenanceSource(provenance?.["authors"]);

  return (
    <LabeledField
      label="Author"
      value={metadata.authors.join(', ')}
      {...(authorProviderId !== undefined ? { providerId: authorProviderId } : {})}
      valueProps={{ size: "sm", c: "dimmed" }}
      labelProps={{ display: "none" }}
    />
  );
}
