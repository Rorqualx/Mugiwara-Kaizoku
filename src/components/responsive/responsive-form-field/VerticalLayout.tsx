/**
 * Vertical Layout Component
 *
 * Displays form field in vertical layout (mobile default)
 */

import React from 'react';

import { Stack } from '@mantine/core';

interface VerticalLayoutProps {
  isMobile: boolean;
  labelComponent: React.ReactNode;
  descriptionComponent: React.ReactNode;
  children: React.ReactNode;
  errorComponent: React.ReactNode;
}

export function VerticalLayout({
  isMobile,
  labelComponent,
  descriptionComponent,
  children,
  errorComponent
}: VerticalLayoutProps): React.ReactElement {
  return (
    <Stack gap={isMobile ? 'xs' : 'sm'}>
      {labelComponent}
      {descriptionComponent}
      {children}
      {errorComponent}
    </Stack>
  );
}
