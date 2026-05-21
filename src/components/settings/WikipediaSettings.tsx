/**
 * Wikipedia provider settings component
 *
 * Wikipedia is a credential-free supplemental source. The master enable toggle
 * lives on the parent `MetadataProviderCard` (writes `wikipedia.enabled`) and
 * is the only setting the backend honors today. Everything else here is
 * descriptive — historical inputs that wrote to a `metadata.wikipedia.*`
 * namespace no consumer ever read have been removed.
 */
import React from 'react';

import { Stack, Text, Alert, Group, Badge } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';

export function WikipediaSettings(): React.ReactElement {
  return (
    <Stack gap="md">
      <Alert icon={<IconInfoCircle size="1rem" />} color="blue">
        <Text size="sm">
          Wikipedia provides supplemental information for manga including plot summaries,
          publication history, and reception information. It&apos;s particularly useful for
          popular series with detailed Wikipedia articles. No API key required — content
          is fetched through the public Wikimedia API.
        </Text>
      </Alert>

      <Stack gap="xs" mt="md">
        <Text size="sm" fw={500}>Features</Text>
        <Group gap="xs">
          <Badge variant="light" color="green">No API Key Required</Badge>
          <Badge variant="light" color="blue">Public API</Badge>
          <Badge variant="light" color="cyan">Multi-language Support</Badge>
          <Badge variant="light" color="orange">Plot Summaries</Badge>
          <Badge variant="light" color="grape">Infobox Data</Badge>
          <Badge variant="light" color="pink">Reception Info</Badge>
        </Group>
      </Stack>

      <Alert icon={<IconInfoCircle size="1rem" />} color="gray" mt="md">
        <Text size="xs">
          Wikipedia data is retrieved through the Wikimedia API and is subject to
          Creative Commons licensing. Content accuracy depends on community contributions.
        </Text>
      </Alert>
    </Stack>
  );
}
