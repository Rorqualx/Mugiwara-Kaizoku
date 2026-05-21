/**
 * ProviderBadge Component
 *
 * Renders a single provider badge with appropriate color and label.
 *
 * @module components/manga/MetadataProvenance/ProviderBadge
 */

import React from 'react';

import { Badge } from '@mantine/core';

import { getProviderColor, getProviderLabel } from './utils';

import type { ProviderBadgeProps } from './types';

/**
 * Renders a badge for a metadata provider
 */
export function ProviderBadge({
  provider,
  size = 'xs'
}: ProviderBadgeProps): React.ReactElement {
  const color = getProviderColor(provider);
  const label = getProviderLabel(provider);

  return (
    <Badge size={size} color={color} variant="light">
      {label}
    </Badge>
  );
}
