/**
 * Stars mode indicator component
 *
 * @module components/metadata/ProviderStrengthIndicator/StarsIndicator
 */

import React from 'react';

import { Group, Text, Tooltip } from '@mantine/core';
import { IconStar, IconStarFilled, IconStarHalf } from '@tabler/icons-react';

import { getSizeInPx, getStarColor } from './utils';

import type { BaseIndicatorProps, IndicatorSize } from './types';

/**
 * Props for StarsIndicator
 */
type StarsIndicatorProps = BaseIndicatorProps;

/**
 * Render star icons based on strength
 */
function renderStars(
  strength: number,
  size: IndicatorSize,
  singleStar = false
): React.ReactElement | React.ReactElement[] {
  const iconSize = getSizeInPx(size);
  const roundedStrength = Math.round(strength * 2) / 2; // Round to nearest 0.5

  if (singleStar) {
    return <IconStarFilled size={iconSize} />;
  }

  const stars: React.ReactElement[] = [];
  const starColor = getStarColor(roundedStrength);

  // Add filled stars
  for (let i = 0; i < Math.floor(roundedStrength); i++) {
    stars.push(
      <IconStarFilled
        key={`filled-${i}`}
        size={iconSize}
        style={{ color: starColor }}
      />
    );
  }

  // Add half star if needed
  if (roundedStrength % 1 !== 0) {
    stars.push(
      <IconStarHalf
        key="half"
        size={iconSize}
        style={{ color: starColor }}
      />
    );
  }

  // Add empty stars
  for (let i = Math.ceil(roundedStrength); i < 5; i++) {
    stars.push(
      <IconStar key={`empty-${i}`} size={iconSize} style={{ color: '#aaa' }} />
    );
  }

  return stars;
}

/**
 * Stars mode indicator display
 */
export function StarsIndicator({
  strength,
  size,
  providerName,
  showProviderName,
  tooltipText,
  className
}: StarsIndicatorProps): React.ReactElement {
  return (
    <Tooltip label={tooltipText} position="top" withArrow>
      <Group
        gap={2}
        wrap="nowrap"
        style={{ display: 'inline-flex' }}
        {...(className ? { className } : {})}
      >
        {showProviderName && (
          <Text size={size} fw={500} mr={4}>
            {providerName}:
          </Text>
        )}
        {renderStars(strength, size)}
      </Group>
    </Tooltip>
  );
}

// Export renderStars for use in BadgeIndicator
export { renderStars };
