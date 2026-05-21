/**
 * MetadataConfidenceDisplay Component
 * 
 * Displays metadata confidence scores and quality indicators
 * with color-coded badges and progress bars.
 */

import React, { memo, useMemo } from 'react';

import {
  Paper,
  Stack,
  Group,
  Text,
  Badge,
  Progress,
  Tooltip,
  SimpleGrid,
  Box,
  ThemeIcon
} from '@mantine/core';
import {
  IconCircleCheck,
  IconAlertCircle,
  IconX,
  IconDatabase,
  IconCalendar,
  IconBook,
  IconTags,
  IconUser
} from '@tabler/icons-react';

import { CONFIDENCE_THRESHOLDS } from '@/components/addManga/types';

interface MetadataField {
  name: string;
  value: unknown;
  source: string;
  confidence?: number;
  isComplete: boolean;
}

interface MetadataConfidenceDisplayProps {
  /** Array of metadata fields with their confidence scores */
  fields: MetadataField[];
  /** Overall confidence score (0-100) */
  overallConfidence: number;
  /** Number of sources contributing to the metadata */
  sourceCount: number;
  /** Whether to show detailed field breakdown */
  showDetails?: boolean;
  /** Whether to show the progress bar */
  showProgress?: boolean;
  /** Compact display mode */
  compact?: boolean;
}

/**
 * Get icon for metadata field type
 */
function getFieldIcon(fieldName: string): React.ReactNode {
  const iconMap: Record<string, React.ReactNode> = {
    title: <IconBook size={16} />,
    authors: <IconUser size={16} />,
    artists: <IconUser size={16} />,
    genres: <IconTags size={16} />,
    tags: <IconTags size={16} />,
    startDate: <IconCalendar size={16} />,
    endDate: <IconCalendar size={16} />,
    releaseYear: <IconCalendar size={16} />,
    chapters: <IconBook size={16} />,
    volumes: <IconBook size={16} />,
    default: <IconDatabase size={16} />
  };

  return iconMap[fieldName] ?? iconMap["default"];
}

/**
 * Get confidence level label and color
 */
function getConfidenceLevel(score: number): {
  label: string;
  color: string;
  icon: React.ReactNode;
} {
  if (score >= CONFIDENCE_THRESHOLDS.excellent) {
    return {
      label: 'Excellent',
      color: 'green',
      icon: <IconCircleCheck size={16} />
    };
  }
  if (score >= CONFIDENCE_THRESHOLDS.good) {
    return {
      label: 'Good',
      color: 'blue',
      icon: <IconCircleCheck size={16} />
    };
  }
  if (score >= CONFIDENCE_THRESHOLDS.fair) {
    return {
      label: 'Fair',
      color: 'yellow',
      icon: <IconAlertCircle size={16} />
    };
  }
  return {
    label: 'Poor',
    color: 'red',
    icon: <IconX size={16} />
  };
}

/**
 * Calculate field completeness percentage
 */
function calculateCompleteness(fields: MetadataField[]): number {
  if (fields.length === 0) return 0;
  const completeFields = fields.filter(f => f.isComplete).length;
  return Math.round((completeFields / fields.length) * 100);
}

/**
 * Group fields by category
 */
function groupFieldsByCategory(fields: MetadataField[]): Record<string, MetadataField[]> {
  const categories: Record<string, string[]> = {
    'Basic Info': ['title', 'description', 'status', 'format'],
    'Creators': ['authors', 'artists'],
    'Categories': ['genres', 'tags', 'themes'],
    'Dates': ['startDate', 'endDate', 'releaseYear'],
    'Content': ['chapters', 'volumes'],
    'IDs': ['anilistId', 'myAnimeListId']
  };

  const grouped: Record<string, MetadataField[]> = {};

  Object.entries(categories).forEach(([category, fieldNames]) => {
    const categoryFields = fields.filter(f => fieldNames.includes(f.name));
    if (categoryFields.length > 0) {
      grouped[category] = categoryFields;
    }
  });

  // Add any remaining fields to 'Other'
  const categorizedFields = new Set(Object.values(categories).flat());
  const otherFields = fields.filter(f => !categorizedFields.has(f.name));
  if (otherFields.length > 0) {
    grouped['Other'] = otherFields;
  }

  return grouped;
}

export const MetadataConfidenceDisplay = memo(function MetadataConfidenceDisplay({
  fields,
  overallConfidence,
  sourceCount,
  showDetails = true,
  showProgress = true,
  compact = false
}: MetadataConfidenceDisplayProps): React.ReactElement {
  const confidence = getConfidenceLevel(overallConfidence);
  const completeness = useMemo(() => calculateCompleteness(fields), [fields]);
  const groupedFields = useMemo(() => groupFieldsByCategory(fields), [fields]);

  if (compact) {
    return (
      <Group gap="xs">
        <Tooltip label={`Overall confidence: ${overallConfidence}%`}>
          <Badge color={confidence.color} variant="filled" size="sm">
            {confidence.icon}
            <Text span ml={4}>{confidence.label}</Text>
          </Badge>
        </Tooltip>
        <Tooltip label={`${completeness}% of fields complete`}>
          <Badge color={completeness > 75 ? 'green' : completeness > 50 ? 'yellow' : 'red'} variant="light" size="sm">
            {completeness}% complete
          </Badge>
        </Tooltip>
        <Tooltip label={`Data from ${sourceCount} source${sourceCount !== 1 ? 's' : ''}`}>
          <Badge color="gray" variant="outline" size="sm">
            {sourceCount} source{sourceCount !== 1 ? 's' : ''}
          </Badge>
        </Tooltip>
      </Group>
    );
  }

  return (
    <Paper p="md" withBorder>
      <Stack gap="md">
        {/* Header */}
        <Group justify="space-between">
          <Group gap="xs">
            <ThemeIcon color={confidence.color} variant="light" size="lg">
              {confidence.icon}
            </ThemeIcon>
            <div>
              <Text fw={500}>Metadata Quality</Text>
              <Text size="xs" c="dimmed">
                {sourceCount} source{sourceCount !== 1 ? 's' : ''} • {fields.length} fields
              </Text>
            </div>
          </Group>
          <Group gap="xs">
            <Badge color={confidence.color} variant="filled" size="lg">
              {confidence.label}
            </Badge>
            <Badge color="gray" variant="light" size="lg">
              {overallConfidence}%
            </Badge>
          </Group>
        </Group>

        {/* Progress bars */}
        {showProgress && (
          <Stack gap="xs">
            <div>
              <Group justify="space-between" mb={4}>
                <Text size="sm" c="dimmed">Confidence Score</Text>
                <Text size="sm" fw={500}>{overallConfidence}%</Text>
              </Group>
              <Progress
                value={overallConfidence}
                color={confidence.color}
                size="lg"
                radius="md"
                striped
                animated={overallConfidence < 100}
              />
            </div>
            <div>
              <Group justify="space-between" mb={4}>
                <Text size="sm" c="dimmed">Field Completeness</Text>
                <Text size="sm" fw={500}>{completeness}%</Text>
              </Group>
              <Progress
                value={completeness}
                color={completeness > 75 ? 'green' : completeness > 50 ? 'yellow' : 'red'}
                size="lg"
                radius="md"
              />
            </div>
          </Stack>
        )}

        {/* Detailed field breakdown */}
        {showDetails && Object.keys(groupedFields).length > 0 && (
          <Stack gap="sm">
            <Text size="sm" fw={500} c="dimmed">Field Details</Text>
            {Object.entries(groupedFields).map(([category, categoryFields]) => (
              <Box key={category}>
                <Text size="xs" fw={500} mb={8}>{category}</Text>
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
                  {categoryFields.map(field => {
                    const fieldConfidence = field.confidence ?? 0;
                    const fieldLevel = getConfidenceLevel(fieldConfidence);
                    
                    return (
                      <Paper key={field.name} p="xs" withBorder>
                        <Group gap="xs" wrap="nowrap">
                          <ThemeIcon
                            color={field.isComplete ? 'green' : 'gray'}
                            variant="light"
                            size="sm"
                          >
                            {getFieldIcon(field.name)}
                          </ThemeIcon>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <Text size="xs" fw={500} truncate>
                              {field.name.replace(/([A-Z])/g, ' $1').trim()}
                            </Text>
                            <Text size="xs" c="dimmed" truncate>
                              from {field.source}
                            </Text>
                          </div>
                          {field.confidence !== undefined && (
                            <Badge
                              color={fieldLevel.color}
                              variant="light"
                              size="xs"
                            >
                              {field.confidence}%
                            </Badge>
                          )}
                        </Group>
                      </Paper>
                    );
                  })}
                </SimpleGrid>
              </Box>
            ))}
          </Stack>
        )}

        {/* Summary stats */}
        <Group gap="xs">
          <Badge variant="outline" color="gray" size="sm">
            {fields.filter(f => f.isComplete).length}/{fields.length} complete
          </Badge>
          {fields.some(f => f.confidence !== undefined && f.confidence >= 80) && (
            <Badge variant="outline" color="green" size="sm">
              {fields.filter(f => f.confidence !== undefined && f.confidence >= 80).length} high confidence
            </Badge>
          )}
          {fields.some(f => f.confidence !== undefined && f.confidence < 50) && (
            <Badge variant="outline" color="orange" size="sm">
              {fields.filter(f => f.confidence !== undefined && f.confidence < 50).length} needs review
            </Badge>
          )}
        </Group>
      </Stack>
    </Paper>
  );
});

// Export a simplified version for inline use
export const MetadataQualityBadge = memo(function MetadataQualityBadge({
  confidence,
  size = 'sm'
}: {
  confidence: number;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}): React.ReactElement {
  const level = getConfidenceLevel(confidence);
  
  return (
    <Tooltip label={`Metadata confidence: ${confidence}%`}>
      <Badge color={level.color} variant="filled" size={size}>
        {level.icon}
        <Text span ml={4}>{level.label}</Text>
      </Badge>
    </Tooltip>
  );
});