/**
 * FieldProvenanceBadge Component
 *
 * Interactive badge showing field provenance with confidence score.
 * Click to select alternative provider for this field.
 *
 * @module components/manga/MetadataProvenance/FieldProvenanceBadge
 */

import React from 'react';

import { Badge, Group, Text, Tooltip, Menu } from '@mantine/core';
import { IconChevronDown } from '@tabler/icons-react';

import { ProviderBadge } from './ProviderBadge';
import { getConfidenceColor, getConfidenceLabel } from './utils';

import type { EnhancedProviderData } from './types';

export interface FieldProvenanceBadgeProps {
  /**
   * Enhanced provenance data for this field
   */
  provenance: EnhancedProviderData;

  /**
   * Field name (for tooltip and selection context)
   */
  field: string;

  /**
   * Callback when badge is clicked to select alternative provider
   */
  onSelectAlternative?: (field: string, provider: string) => void;

  /**
   * Size of the badge
   */
  size?: 'xs' | 'sm' | 'md' | 'lg';

  /**
   * Whether to show confidence score as text
   */
  showConfidenceText?: boolean;
}

/**
 * Interactive field provenance badge with confidence scoring
 */
export function FieldProvenanceBadge({
  provenance,
  field,
  onSelectAlternative,
  size = 'xs',
  showConfidenceText = false
}: FieldProvenanceBadgeProps): React.ReactElement {
  const { provider, confidence, quality, alternatives = [] } = provenance;
  const confidenceColor = getConfidenceColor(confidence);
  const confidenceLabel = getConfidenceLabel(confidence);

  // Format tooltip content
  const tooltipContent = React.useMemo(() => {
    let content = `Source: ${provider}\nConfidence: ${confidence}% (${confidenceLabel})`;

    if (quality !== undefined) {
      content += `\nQuality Score: ${Math.round(quality * 100)}%`;
    }

    if (alternatives.length > 0) {
      content += `\n\nAlternatives:`;
      alternatives.forEach((alt) => {
        const altConfidenceLabel = getConfidenceLabel(alt.confidence);
        content += `\n• ${alt.provider}: ${alt.confidence}% (${altConfidenceLabel})`;
        if (alt.quality !== undefined) {
          content += `, Quality: ${Math.round(alt.quality * 100)}%`;
        }
      });
      content += `\n\nClick to select alternative provider`;
    }

    return content;
  }, [provider, confidence, confidenceLabel, quality, alternatives]);

  // Format value preview for dropdown display
  const formatValuePreview = React.useCallback((value: unknown): string => {
    if (value === null || value === undefined || value === '') {
      return 'Empty';
    }
    if (Array.isArray(value)) {
      if (value.length === 0) return 'Empty array';
      return value.slice(0, 2).join(', ') + (value.length > 2 ? '...' : '');
    }
    if (typeof value === 'string') {
      return value.length > 30 ? value.substring(0, 30) + '...' : value;
    }
    if (typeof value === 'number') {
      return value.toString();
    }
    return String(value).substring(0, 30);
  }, []);

  // If no alternatives or no callback, show simple badge
  if (!onSelectAlternative || alternatives.length === 0) {
    return (
      <Tooltip label={tooltipContent} multiline>
        <Group gap={4} wrap="nowrap">
          <ProviderBadge provider={provider} size={size} />
          <Badge size={size} color={confidenceColor} variant="light">
            {showConfidenceText ? `${confidence}%` : confidenceLabel}
          </Badge>
        </Group>
      </Tooltip>
    );
  }

  // Show interactive dropdown menu with alternatives
  return (
    <Menu shadow="md" width={300} position="bottom-end">
      <Menu.Target>
        <Group
          gap={4}
          wrap="nowrap"
          style={{ cursor: 'pointer' }}
        >
          <ProviderBadge provider={provider} size={size} />
          <Badge size={size} color={confidenceColor} variant="light">
            {showConfidenceText ? `${confidence}%` : confidenceLabel}
          </Badge>
          <IconChevronDown size={12} />
          <Text size="xs" c="dimmed">
            +{alternatives.length}
          </Text>
        </Group>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Label>Current Provider</Menu.Label>
        <Menu.Item disabled>
          <Group justify="space-between" wrap="nowrap">
            <ProviderBadge provider={provider} size="xs" />
            <Badge size="xs" color={confidenceColor} variant="light">
              {confidence}%
            </Badge>
          </Group>
        </Menu.Item>

        <Menu.Divider />

        <Menu.Label>Alternative Providers</Menu.Label>
        {alternatives.map((alt) => (
          <Menu.Item
            key={alt.provider}
            onClick={() => onSelectAlternative(field, alt.provider)}
          >
            <Group justify="space-between" wrap="nowrap" gap="xs">
              <ProviderBadge provider={alt.provider} size="xs" />
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <Text size="xs" c="dimmed" truncate>
                  {formatValuePreview(alt.value)}
                </Text>
              </div>
              <Badge
                size="xs"
                color={getConfidenceColor(alt.confidence)}
                variant="light"
              >
                {alt.confidence}%
              </Badge>
            </Group>
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}