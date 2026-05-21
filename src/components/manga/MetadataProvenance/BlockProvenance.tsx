/**
 * BlockProvenance Component
 *
 * Renders provenance information in a block format with all provider badges.
 *
 * @module components/manga/MetadataProvenance/BlockProvenance
 */

import React from 'react';

import { Badge, Group, Text, Tooltip } from '@mantine/core';

import { ProviderBadge } from './ProviderBadge';
import {
  formatBlockTooltipLabel,
  getProviderData,
  parseProviders,
  getConfidenceColor
} from './utils';

import type { BaseProvenanceProps } from './types';

/**
 * Block variant of metadata provenance display
 */
export function BlockProvenance({
  field,
  provenance,
  enhancedProvenance,
  showConfidence = false,
  label,
  value,
  size = 'xs'
}: BaseProvenanceProps): React.ReactElement {
  // Use enhanced provenance if available, otherwise fall back to legacy provenance
  let provider: string | undefined;
  let confidence: number | undefined;

  if (enhancedProvenance) {
    // Enhanced provenance data
    provider = enhancedProvenance.provider;
    confidence = enhancedProvenance.confidence;
  } else {
    // Legacy provider data
    const providerData = getProviderData(provenance, field);
    if (providerData) {
      provider = providerData.source;
      confidence = providerData.confidence;
    }
  }

  if (!provider) {
    return (
      <>
        {label && (
          <Text span fw={500}>
            {label}:{' '}
          </Text>
        )}
        {value}
      </>
    );
  }

  const parsed = parseProviders(provider as string);
  const { primaryProvider, additionalProviders } = parsed;
  const tooltipLabel = formatBlockTooltipLabel(parsed, confidence as number | undefined);

  return (
    <div>
      <Group gap="xs" mb={4}>
        {label && <Text fw={500}>{label}</Text>}
        <Tooltip label={tooltipLabel}>
          <Group gap={4}>
            {primaryProvider && (
              <ProviderBadge provider={primaryProvider} size={size} />
            )}
            {showConfidence && confidence !== undefined && (
              <Badge
                size={size}
                color={getConfidenceColor(confidence)}
                variant="light"
              >
                {confidence}%
              </Badge>
            )}
            {additionalProviders.map((p) => (
              <ProviderBadge key={p} provider={p} size={size} />
            ))}
          </Group>
        </Tooltip>
      </Group>
      {value}
    </div>
  );
}
