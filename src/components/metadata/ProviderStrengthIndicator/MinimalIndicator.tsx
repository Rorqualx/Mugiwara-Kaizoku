/**
 * Minimal mode indicator component
 *
 * @module components/metadata/ProviderStrengthIndicator/MinimalIndicator
 */

import React from 'react';

import { Text, Tooltip, useMantineTheme } from '@mantine/core';

import type { BaseIndicatorProps } from './types';

/**
 * Props for MinimalIndicator
 */
type MinimalIndicatorProps = BaseIndicatorProps;

/**
 * Minimal mode indicator display (just the colored number)
 */
export function MinimalIndicator({
  strength,
  color,
  size,
  tooltipText,
  className
}: MinimalIndicatorProps): React.ReactElement {
  const theme = useMantineTheme();
  const colorRef = theme.colors[color]?.[6];

  return (
    <Tooltip label={tooltipText} position="top" withArrow>
      <Text
        size={size}
        fw={700}
        style={{ display: 'inline' }}
        {...(colorRef ? { c: colorRef } : {})}
        {...(className ? { className } : {})}
      >
        {strength}
      </Text>
    </Tooltip>
  );
}
