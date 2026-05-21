/**
 * AvailableSourcesList Component
 *
 * Displays a list of available sources for a provider
 */
import React from 'react';

import { Text, Group, Badge } from '@mantine/core';

interface AvailableSourcesListProps {
  providerName: string;
  sources: string[];
  enabled: boolean;
}

/**
 * Displays available sources for a provider
 */
export function AvailableSourcesList({
  providerName,
  sources,
  enabled
}: AvailableSourcesListProps): React.ReactElement | null {
  if (!enabled) {
    return null;
  }

  return (
    <>
      <Text size="sm" fw={600} mb="xs">
        {providerName} Sources
      </Text>
      {sources.length > 0 ? (
        <Group gap="xs">
          {sources.map((source: string) => (
            <Badge key={source} size="lg" color="indigo">
              {source}
            </Badge>
          ))}
        </Group>
      ) : (
        <Text c="dimmed">No sources available</Text>
      )}
    </>
  );
}
