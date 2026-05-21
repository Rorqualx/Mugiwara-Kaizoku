/**
 * InlineProvenance Component
 *
 * Renders provenance information in an inline format with badges.
 *
 * @module components/manga/MetadataProvenance/InlineProvenance
 */

import React from 'react';

import { Badge, Group, Text, Tooltip } from '@mantine/core';

import { ProviderBadge } from './ProviderBadge';
import {
  formatInlineTooltipLabel,
  getProviderData,
  parseProviders,
  getConfidenceColor
} from './utils';

import type { BaseProvenanceProps } from './types';

/**
 * Inline variant of metadata provenance display
 */
export function InlineProvenance({
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
  const tooltipLabel = formatInlineTooltipLabel(parsed, confidence as number | undefined);

  return (
    <Group gap="xs" wrap="nowrap">
      {label && (
        <Text span fw={500}>
          {label}:{' '}
        </Text>
      )}
      {value}
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
          {additionalProviders.length > 0 && (
            <Text size="xs" c="dimmed">
              +{additionalProviders.length}
            </Text>
          )}
        </Group>
      </Tooltip>
    </Group>
  );
}
