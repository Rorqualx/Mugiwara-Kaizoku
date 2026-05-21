/**
 * Metadata Header Component
 *
 * Displays the manga title
 */

import React from 'react';

import { Text } from '@mantine/core';

interface MetadataHeaderProps {
  title: string;
}

export function MetadataHeader({ title }: MetadataHeaderProps): React.ReactElement {
  return (
    <Text fw={700} size="lg" component="h2">
      {title}
    </Text>
  );
}
