/**
 * ProviderBadge Component
 *
 * Renders a color-coded badge for a metadata provider.
 */

'use client';

import React, { forwardRef } from 'react';

import { Badge, type DefaultMantineColor } from '@mantine/core';

interface ProviderBadgeProps {
  provider: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

// Provider color mapping
const PROVIDER_COLORS: Record<string, DefaultMantineColor> = {
  anilist: 'blue',
  comicvine: 'green',
  fandom: 'violet',
  wikipedia: 'cyan',
};

const DEFAULT_COLOR: DefaultMantineColor = 'blue';

export const ProviderBadge = forwardRef<HTMLDivElement, ProviderBadgeProps>(
  function ProviderBadge({ provider, size = 'sm' }, ref) {
    const color = PROVIDER_COLORS[provider.toLowerCase()] ?? DEFAULT_COLOR;

    return (
      <Badge ref={ref} color={color} size={size}>
        {provider}
      </Badge>
    );
  }
);

// Helper to use as render function
export function renderProviderBadge(provider: string): React.ReactNode {
  return <ProviderBadge provider={provider} />;
}

export default ProviderBadge;
