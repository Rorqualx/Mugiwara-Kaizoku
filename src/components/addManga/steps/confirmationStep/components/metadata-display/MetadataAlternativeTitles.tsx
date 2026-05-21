/**
 * Metadata Alternative Titles
 *
 * Displays alternative titles in a card
 */

import React from 'react';

import { Card, Text, Stack } from '@mantine/core';

interface MetadataAlternativeTitlesProps {
  alternativeTitles?: string[] | undefined;
}

export function MetadataAlternativeTitles({
  alternativeTitles
}: MetadataAlternativeTitlesProps): React.ReactElement | null {
  if (!alternativeTitles || alternativeTitles.length === 0) return null;

  return (
    <Card shadow="sm" padding="md" radius="md">
      <Text size="sm" fw={600} c="dimmed" mb="xs">
        Alternative Titles
      </Text>
      <Stack gap="xs">
        {alternativeTitles.map((title, index) => (
          <Text key={index} size="sm">
            • {title}
          </Text>
        ))}
      </Stack>
    </Card>
  );
}
