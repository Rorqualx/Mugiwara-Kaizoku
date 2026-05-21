/**
 * Badge mode indicator component
 *
 * @module components/metadata/ProviderStrengthIndicator/BadgeIndicator
 */

import React from 'react';

import { Badge, Tooltip } from '@mantine/core';

import { renderStars } from './StarsIndicator';

import type { BaseIndicatorProps } from './types';

/**
 * Props for BadgeIndicator
 */
type BadgeIndicatorProps = BaseIndicatorProps;

/**
 * Badge mode indicator display
 */
export function BadgeIndicator({
  strength,
  color,
  size,
  providerName,
  showProviderName,
  tooltipText,
  className
}: BadgeIndicatorProps): React.ReactElement {
  const leftSection = showProviderName ? undefined : renderStars(strength, 'xs', true);

  return (
    <Tooltip label={tooltipText} position="top" withArrow>
      <Badge
        color={color}
        size={size}
        {...(className ? { className } : {})}
        {...(leftSection ? { leftSection } : {})}
      >
        {showProviderName ? `${providerName}: ${strength}/5` : `${strength}/5`}
      </Badge>
    </Tooltip>
  );
}
