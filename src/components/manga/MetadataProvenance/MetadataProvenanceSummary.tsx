/**
 * MetadataProvenanceSummary Component
 *
 * Shows comprehensive summary of metadata provenance across all fields
 * with overall confidence scores and provider distribution.
 *
 * @module components/manga/MetadataProvenance/MetadataProvenanceSummary
 */

import React from 'react';

import { Card, Group, Stack, Text, Progress, Badge, Tooltip } from '@mantine/core';

import { ProviderBadge } from './ProviderBadge';
import { getConfidenceColor, getConfidenceLabel } from './utils';

import type { EnhancedProviderData } from './types';

export interface MetadataProvenanceSummaryProps {
  /**
   * Field provenance data for all fields
   */
  fieldProvenance: Record<string, EnhancedProviderData>;

  /**
   * Optional title for the summary card
   */
  title?: string;

  /**
   * Whether to show detailed field breakdown
   */
  showFieldBreakdown?: boolean;

  /**
   * Whether to show provider distribution
   */
  showProviderDistribution?: boolean;
}

/**
 * Comprehensive metadata provenance summary component
 */
export function MetadataProvenanceSummary({
  fieldProvenance,
  title = 'Metadata Provenance Summary',
  showFieldBreakdown = true,
  showProviderDistribution = true
}: MetadataProvenanceSummaryProps): React.ReactElement {
  const fields = Object.keys(fieldProvenance);

  if (fields.length === 0) {
    return (
      <Card withBorder padding="md" radius="md">
        <Text c="dimmed" ta="center">No metadata provenance data available</Text>
      </Card>
    );
  }

  // Calculate overall statistics
  const totalFields = fields.length;
  const totalConfidence = fields.reduce((sum, field) => {
    const provenance = fieldProvenance[field];
    return sum + (provenance?.confidence ?? 0);
  }, 0);
  const averageConfidence = Math.round(totalConfidence / totalFields);
  const averageConfidenceColor = getConfidenceColor(averageConfidence);
  const averageConfidenceLabel = getConfidenceLabel(averageConfidence);

  // Count fields by confidence level
  const confidenceLevels = {
    excellent: 0, // ≥80
    good: 0,      // ≥60
    fair: 0,      // ≥40
    poor: 0       // <40
  };

  fields.forEach((field) => {
    const provenance = fieldProvenance[field];
    const confidence = provenance?.confidence ?? 0;
    if (confidence >= 80) confidenceLevels.excellent++;
    else if (confidence >= 60) confidenceLevels.good++;
    else if (confidence >= 40) confidenceLevels.fair++;
    else confidenceLevels.poor++;
  });

  // Calculate provider distribution
  const providerCounts: Record<string, number> = {};
  fields.forEach((field) => {
    const provenance = fieldProvenance[field];
    const provider = provenance?.provider;
    if (provider) {
      providerCounts[provider] = (providerCounts[provider] || 0) + 1;
    }
  });

  // Sort providers by count (descending)
  const sortedProviders = Object.entries(providerCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([provider, count]) => ({ provider, count, percentage: Math.round((count / totalFields) * 100) }));

  return (
    <Card withBorder padding="md" radius="md">
      <Stack gap="md">
        <Group justify="space-between">
          <Text fw={600} size="lg">{title}</Text>
          <Badge color={averageConfidenceColor} variant="light">
            Avg: {averageConfidence}% ({averageConfidenceLabel})
          </Badge>
        </Group>

        {/* Overall confidence summary */}
        <div>
          <Group justify="space-between" mb={4}>
            <Text size="sm" fw={500}>Overall Confidence</Text>
            <Text size="sm" fw={500}>{averageConfidence}%</Text>
          </Group>
          <Progress
            value={averageConfidence}
            color={averageConfidenceColor}
            size="lg"
            radius="xl"
          />
          <Group justify="space-between" mt={8}>
            <Text size="xs" c="dimmed">Poor ({confidenceLevels.poor})</Text>
            <Text size="xs" c="dimmed">Fair ({confidenceLevels.fair})</Text>
            <Text size="xs" c="dimmed">Good ({confidenceLevels.good})</Text>
            <Text size="xs" c="dimmed">Excellent ({confidenceLevels.excellent})</Text>
          </Group>
        </div>

        {/* Provider distribution */}
        {showProviderDistribution && sortedProviders.length > 0 && (
          <div>
            <Text size="sm" fw={500} mb={8}>Provider Distribution</Text>
            <Stack gap={6}>
              {sortedProviders.map(({ provider, count, percentage }) => (
                <div key={provider}>
                  <Group justify="space-between" mb={2}>
                    <Group gap={6}>
                      <ProviderBadge provider={provider} size="xs" />
                      <Text size="sm">{provider}</Text>
                    </Group>
                    <Text size="sm" fw={500}>{percentage}% ({count})</Text>
                  </Group>
                  <Progress
                    value={percentage}
                    color="blue"
                    size="sm"
                    radius="xl"
                  />
                </div>
              ))}
            </Stack>
          </div>
        )}

        {/* Field breakdown */}
        {showFieldBreakdown && (
          <div>
            <Text size="sm" fw={500} mb={8}>Field Confidence Breakdown</Text>
            <Stack gap={6}>
              {fields.map((field) => {
                const provenance = fieldProvenance[field];
                if (!provenance) {
                  return null;
                }

                const confidenceColor = getConfidenceColor(provenance.confidence);
                const confidenceLabel = getConfidenceLabel(provenance.confidence);

                return (
                  <Tooltip
                    key={field}
                    label={`${field}: ${provenance.provider} (${provenance.confidence}% ${confidenceLabel})`}
                    multiline
                  >
                    <div>
                      <Group justify="space-between" mb={2}>
                        <Group gap={6}>
                          <ProviderBadge provider={provenance.provider} size="xs" />
                          <Text size="sm" style={{ textTransform: 'capitalize' }}>
                            {field.replace(/([A-Z])/g, ' $1').toLowerCase()}
                          </Text>
                        </Group>
                        <Badge size="xs" color={confidenceColor} variant="light">
                          {provenance.confidence}%
                        </Badge>
                      </Group>
                      <Progress
                        value={provenance.confidence}
                        color={confidenceColor}
                        size="sm"
                        radius="xl"
                      />
                    </div>
                  </Tooltip>
                );
              })}
            </Stack>
          </div>
        )}
      </Stack>
    </Card>
  );
}