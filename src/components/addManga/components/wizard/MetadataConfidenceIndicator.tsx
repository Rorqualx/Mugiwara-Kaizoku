import React from 'react';

import { Group, Text, Badge, RingProgress } from '@mantine/core';

interface MetadataConfidenceIndicatorProps {
  fieldName: string;
  value: unknown;
  confidence: number;
  getConfidenceColor: (confidence: number) => string;
}

/**
 * Shows metadata field with confidence scoring
 */
export const MetadataConfidenceIndicator: React.FC<MetadataConfidenceIndicatorProps> = ({
  fieldName,
  value,
  confidence,
  getConfidenceColor
}) => {
  const hasValue = value && (Array.isArray(value) ? value.length > 0 : true);
  const confidencePercentage = (confidence * 100).toFixed(0);
  const color = getConfidenceColor(confidence);

  // Format field name for display
  const displayName = fieldName
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .replace(/^./, str => str.toUpperCase());

  return (
    <Group justify="space-between">
      <Text size="xs" tt="capitalize">
        {displayName}
      </Text>
      <Group gap="xs">
        {hasValue ? (
          <Badge size="xs" color="green">Set</Badge>
        ) : (
          <Badge size="xs" color="gray">Missing</Badge>
        )}
        <Badge size="xs" color={color}>
          {confidencePercentage}%
        </Badge>
      </Group>
    </Group>
  );
};

/**
 * Shows overall confidence score with ring progress
 */
export const OverallConfidenceScore: React.FC<{
  score: number;
  getConfidenceColor: (confidence: number) => string;
}> = ({ score, getConfidenceColor }) => {
  const color = getConfidenceColor(score / 100);

  return (
    <Group>
      <RingProgress
        size={60}
        thickness={4}
        sections={[
          { value: score, color }
        ]}
        label={
          <Text size="xs" ta="center">
            {score}%
          </Text>
        }
      />
      <div>
        <Text size="sm" fw={500}>Metadata Quality</Text>
        <Text size="xs" c="dimmed">
          {score >= 80 ? 'Excellent' :
           score >= 60 ? 'Good' :
           score >= 40 ? 'Fair' : 'Poor'}
        </Text>
      </div>
    </Group>
  );
};

export default MetadataConfidenceIndicator;