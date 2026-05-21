/**
 * Horizontal Layout Component
 *
 * Displays form field in horizontal layout (desktop)
 */

import React from 'react';

import { Box, Group } from '@mantine/core';

interface HorizontalLayoutProps {
  isMobile: boolean;
  labelWidth: number | string;
  labelComponent: React.ReactNode;
  descriptionComponent: React.ReactNode;
  children: React.ReactNode;
  errorComponent: React.ReactNode;
}

export function HorizontalLayout({
  isMobile,
  labelWidth,
  labelComponent,
  descriptionComponent,
  children,
  errorComponent
}: HorizontalLayoutProps): React.ReactElement {
  return (
    <Box>
      <Group align="flex-start" gap={isMobile ? 'sm' : 'md'}>
        <Box
          style={{
            minWidth: labelWidth,
            flexShrink: 0,
            paddingTop: 8 // Align with input
          }}
        >
          {labelComponent}
          {descriptionComponent}
        </Box>

        <Box style={{ flex: 1 }}>
          {children}
          {errorComponent}
        </Box>
      </Group>
    </Box>
  );
}
