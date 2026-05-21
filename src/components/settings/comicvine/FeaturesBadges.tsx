/**
 * ComicVine Features Display
 */
import React from 'react';

import { Stack, Text, Group, Badge } from '@mantine/core';

/**
 * Display ComicVine feature badges
 */
export function FeaturesBadges(): React.ReactElement {
  return (
    <Stack gap="xs">
      <Text size="sm" fw={500}>Features</Text>
      <Group gap="xs">
        <Badge variant="light" color="red">API Key Required</Badge>
        <Badge variant="light" color="blue">Comic Database</Badge>
        <Badge variant="light" color="orange">Rate Limited</Badge>
        <Badge variant="light" color="cyan">Volume/Issue Data</Badge>
        <Badge variant="light" color="grape">Publisher Info</Badge>
      </Group>
    </Stack>
  );
}
