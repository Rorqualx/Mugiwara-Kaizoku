/**
 * Field Description Component
 *
 * Displays form field description text
 */

import React from 'react';

import { Text } from '@mantine/core';

interface FieldDescriptionProps {
  description?: React.ReactNode;
  isMobile: boolean;
  layout: 'vertical' | 'horizontal' | 'top' | 'left';
}

export function FieldDescription({ description, isMobile, layout }: FieldDescriptionProps): React.ReactElement | null {
  if (!description) return null;

  return (
    <Text
      size={isMobile ? 'xs' : 'sm'}
      c="dimmed"
      mt={layout === 'vertical' ? 4 : 0}
    >
      {description}
    </Text>
  );
}
