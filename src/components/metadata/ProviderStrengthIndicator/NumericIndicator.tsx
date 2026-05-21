/**
 * Numeric mode indicator component
 *
 * @module components/metadata/ProviderStrengthIndicator/NumericIndicator
 */

import React from 'react';

import { Box, Group, Text, Tooltip, useMantineTheme } from '@mantine/core';

import { getSizeInPx } from './utils';

import type { BaseIndicatorProps } from './types';

/**
 * Props for NumericIndicator
 */
type NumericIndicatorProps = BaseIndicatorProps;

/**
 * Numeric mode indicator display (default)
 */
export function NumericIndicator({
  strength,
  color,
  size,
  providerName,
  showProviderName,
  tooltipText,
  className
}: NumericIndicatorProps): React.ReactElement {
  const theme = useMantineTheme();
  const bgColor = theme.colors[color]?.[1];
  const textColor = theme.colors[color]?.[8];

  return (
    <Tooltip label={tooltipText} position="top" withArrow>
      <Group
        gap={4}
        wrap="nowrap"
        style={{ display: 'inline-flex' }}
        {...(className ? { className } : {})}
      >
        {showProviderName && (
          <Text size={size} fw={500} mr={2}>
            {providerName}:
          </Text>
        )}
        <Box
          style={{
            backgroundColor: bgColor ?? 'gray',
            color: textColor ?? 'black',
            padding: '2px 6px',
            borderRadius: '4px',
            fontWeight: 700,
            fontSize: getSizeInPx(size),
            display: 'inline-block'
          }}
        >
          {strength}/5
        </Box>
      </Group>
    </Tooltip>
  );
}
