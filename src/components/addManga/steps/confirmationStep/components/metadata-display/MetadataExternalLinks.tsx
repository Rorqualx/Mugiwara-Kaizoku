/**
 * Metadata External Links
 *
 * Displays external links in a card
 */

import React from 'react';

import { Card, Group, Text, Button } from '@mantine/core';

interface MetadataExternalLinksProps {
  url?: string | undefined;
}

export function MetadataExternalLinks({
  url
}: MetadataExternalLinksProps): React.ReactElement | null {
  if (!url) return null;

  return (
    <Card shadow="sm" padding="md" radius="md">
      <Group justify="space-between">
        <Text size="sm" fw={600} c="dimmed">
          External Links
        </Text>
        <Button
          variant="light"
          size="xs"
          onClick={() => window.open(url, '_blank')}
        >
          View on Source
        </Button>
      </Group>
    </Card>
  );
}
