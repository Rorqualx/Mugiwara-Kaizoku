/**
 * Provider Attribution Badge Component
 *
 * Displays which provider contributed a specific piece of data.
 * Used to show data provenance in merged volume displays.
 *
 * Example: "Cover: ComicVine" or "ISBN: Wikipedia"
 */

import React from 'react';

import { Badge, Tooltip, Group, Text } from '@mantine/core';
import { IconDatabase } from '@tabler/icons-react';

// ============================================================================
// Types
// ============================================================================

interface ProviderAttributionBadgeProps {
  /** The field name being attributed */
  field: string;
  /** The provider that contributed this field */
  provider: string;
  /** Badge size */
  size?: 'xs' | 'sm' | 'md';
  /** Whether to show the field label */
  showFieldLabel?: boolean;
  /** Whether to show icon */
  showIcon?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const PROVIDER_COLORS: Record<string, string> = {
  wikipedia: 'gray',
  fandom: 'orange',
  comicvine: 'red',
  anilist: 'blue',
};

const PROVIDER_LABELS: Record<string, string> = {
  wikipedia: 'Wikipedia',
  fandom: 'Fandom',
  comicvine: 'ComicVine',
  anilist: 'AniList',
};

const FIELD_LABELS: Record<string, string> = {
  coverImage: 'Cover',
  cover: 'Cover',
  title: 'Title',
  description: 'Description',
  summary: 'Summary',
  isbn: 'ISBN',
  isbn13: 'ISBN-13',
  releaseDate: 'Release',
  publisher: 'Publisher',
  pageCount: 'Pages',
};

// ============================================================================
// Component
// ============================================================================

/**
 * ProviderAttributionBadge displays the source of a data field
 *
 * @param props - Component properties
 * @returns Badge showing provider attribution
 */
export const ProviderAttributionBadge: React.FC<ProviderAttributionBadgeProps> = ({
  field,
  provider,
  size = 'xs',
  showFieldLabel = true,
  showIcon = false,
}): JSX.Element => {
  const providerLower = provider.toLowerCase();
  const color = PROVIDER_COLORS[providerLower] ?? 'gray';
  const providerLabel = PROVIDER_LABELS[providerLower] ?? provider;
  const fieldLabel = FIELD_LABELS[field] ?? field;

  const badgeContent = showFieldLabel ? `${fieldLabel}: ${providerLabel}` : providerLabel;

  return (
    <Tooltip
      label={`This ${fieldLabel.toLowerCase()} was sourced from ${providerLabel}`}
      position="top"
      withArrow
    >
      <Badge
        size={size}
        color={color}
        variant="light"
        leftSection={showIcon ? <IconDatabase size={10} /> : undefined}
      >
        {badgeContent}
      </Badge>
    </Tooltip>
  );
};

// ============================================================================
// Multi-Field Attribution Component
// ============================================================================

interface ProviderAttributionGroupProps {
  /** Map of field names to their source providers */
  attributions: Record<string, string>;
  /** Badge size */
  size?: 'xs' | 'sm' | 'md';
  /** Maximum badges to show before collapsing */
  maxVisible?: number;
}

/**
 * ProviderAttributionGroup displays multiple provider attributions
 *
 * @param props - Component properties
 * @returns Group of attribution badges
 */
export const ProviderAttributionGroup: React.FC<ProviderAttributionGroupProps> = ({
  attributions,
  size = 'xs',
  maxVisible = 3,
}): JSX.Element | null => {
  const entries = Object.entries(attributions).filter(([_, provider]) => provider);

  if (entries.length === 0) {
    return null;
  }

  const visibleEntries = entries.slice(0, maxVisible);
  const hiddenCount = entries.length - maxVisible;

  return (
    <Group gap={4}>
      {visibleEntries.map(([field, provider]) => (
        <ProviderAttributionBadge
          key={field}
          field={field}
          provider={provider}
          size={size}
          showFieldLabel={true}
        />
      ))}
      {hiddenCount > 0 && (
        <Tooltip
          label={entries
            .slice(maxVisible)
            .map(([f, p]) => `${FIELD_LABELS[f] ?? f}: ${PROVIDER_LABELS[p.toLowerCase()] ?? p}`)
            .join(', ')}
          position="top"
          withArrow
        >
          <Badge size={size} color="gray" variant="outline">
            +{hiddenCount} more
          </Badge>
        </Tooltip>
      )}
    </Group>
  );
};

// ============================================================================
// Provider Summary Component
// ============================================================================

interface ProviderSummaryProps {
  /** Map of providers to the fields they contributed */
  providerFields: Record<string, string[]>;
  /** Display style */
  variant?: 'badges' | 'text';
}

/**
 * ProviderSummary shows a summary of which providers contributed data
 *
 * @param props - Component properties
 * @returns Summary display of provider contributions
 */
export const ProviderSummary: React.FC<ProviderSummaryProps> = ({
  providerFields,
  variant = 'badges',
}): JSX.Element | null => {
  const entries = Object.entries(providerFields).filter(([_, fields]) => fields.length > 0);

  if (entries.length === 0) {
    return null;
  }

  if (variant === 'text') {
    return (
      <Text size="xs" c="dimmed">
        Data from:{' '}
        {entries
          .map(([provider, fields]) => {
            const label = PROVIDER_LABELS[provider.toLowerCase()] ?? provider;
            return `${label} (${fields.length} fields)`;
          })
          .join(', ')}
      </Text>
    );
  }

  return (
    <Group gap={4}>
      {entries.map(([provider, fields]) => {
        const providerLower = provider.toLowerCase();
        const color = PROVIDER_COLORS[providerLower] ?? 'gray';
        const label = PROVIDER_LABELS[providerLower] ?? provider;

        return (
          <Tooltip
            key={provider}
            label={`${label} provided: ${fields.map(f => FIELD_LABELS[f] ?? f).join(', ')}`}
            position="top"
            withArrow
          >
            <Badge size="xs" color={color} variant="light">
              {label} ({fields.length})
            </Badge>
          </Tooltip>
        );
      })}
    </Group>
  );
};

export default ProviderAttributionBadge;
