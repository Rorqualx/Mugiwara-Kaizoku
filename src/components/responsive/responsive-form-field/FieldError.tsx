/**
 * Field Error Component
 *
 * Displays form field error message
 */

import React from 'react';

import { Text } from '@mantine/core';

interface FieldErrorProps {
  error?: React.ReactNode;
  isMobile: boolean;
}

export function FieldError({ error, isMobile }: FieldErrorProps): React.ReactElement | null {
  if (!error) return null;

  return (
    <Text
      size={isMobile ? 'xs' : 'sm'}
      c="red"
      mt={4}
    >
      {error}
    </Text>
  );
}
