/**
 * ProvenanceIndicator Component
 *
 * Shows an info icon with provenance details on hover.
 *
 * @module components/manga/MetadataProvenance/ProvenanceIndicator
 */

import React from 'react';

import { Tooltip } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';

import { getProviderColor, getProviderData, getProviderLabel, parseProviders } from './utils';

import type { ProvenanceIndicatorProps } from './types';

/**
 * Component to show an info icon with provenance details
 */
export function ProvenanceIndicator({
  field,
  provenance,
  size = 16
}: ProvenanceIndicatorProps): React.ReactElement | null {
  const providerData = getProviderData(provenance, field);
  const provider = providerData?.source;

  if (!provider) return null;

  const parsed = parseProviders(provider);
  const providerLabels = parsed.allProviders
    .map((p: string) => getProviderLabel(p))
    .join(', ');
  const color = getProviderColor(parsed.primaryProvider);

  return (
    <Tooltip label={`Source: ${providerLabels}`}>
      <IconInfoCircle
        size={size}
        style={{ opacity: 0.6, cursor: 'help' }}
        color={color}
      />
    </Tooltip>
  );
}
