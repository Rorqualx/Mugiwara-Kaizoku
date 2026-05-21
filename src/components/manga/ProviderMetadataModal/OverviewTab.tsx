import React from 'react';

import {
  Stack,
  Group,
  Text,
  Badge,
  Image,
  ScrollArea,
  Button,
  Grid,
  Card
} from '@mantine/core';
import {
  IconCalendar,
  IconUser,
  IconExternalLink
} from '@tabler/icons-react';

import type { ProviderMetadataResponse } from '@/types/search.types';

import { formatDate } from './utils';

interface OverviewTabProps {
  metadata: ProviderMetadataResponse;
  provider: string;
}

export function OverviewTab({ metadata, provider }: OverviewTabProps): React.ReactElement {
  return (
    <>
      <Grid>
        <Grid.Col span={{ base: 12, md: 4 }}>
          {metadata.coverUrl && (
            <Image
              src={metadata.coverUrl}
              alt={metadata.title}
              radius="md"
            />
          )}
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Stack gap="sm">
            <Group gap="xs">
              <Text size="sm" c="dimmed">Status:</Text>
              <Badge color={metadata.status === 'COMPLETED' ? 'green' : 'blue'}>
                {metadata.status ?? 'Unknown'}
              </Badge>
            </Group>

            {metadata.author && (
              <Group gap="xs">
                <IconUser size={16} />
                <Text size="sm" c="dimmed">Author:</Text>
                <Text size="sm">{metadata.author}</Text>
              </Group>
            )}

            {metadata.artist && metadata.artist !== metadata.author && (
              <Group gap="xs">
                <IconUser size={16} />
                <Text size="sm" c="dimmed">Artist:</Text>
                <Text size="sm">{metadata.artist}</Text>
              </Group>
            )}

            <Group gap="xs">
              <IconCalendar size={16} />
              <Text size="sm" c="dimmed">Start Date:</Text>
              <Text size="sm">{formatDate(metadata.startDate)}</Text>
            </Group>

            {metadata.endDate && (
              <Group gap="xs">
                <IconCalendar size={16} />
                <Text size="sm" c="dimmed">End Date:</Text>
                <Text size="sm">{formatDate(metadata.endDate)}</Text>
              </Group>
            )}

            {metadata.externalUrl && (
              <Button
                variant="subtle"
                size="xs"
                leftSection={<IconExternalLink size={14} />}
                component="a"
                href={metadata.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                View on {provider}
              </Button>
            )}
          </Stack>
        </Grid.Col>
      </Grid>

      {metadata.description && (
        <Card mt="md" p="md" withBorder>
          <Text size="sm" fw={500} mb="xs">Description</Text>
          <ScrollArea style={{ height: 150 }}>
            <Text size="sm">{metadata.description}</Text>
          </ScrollArea>
        </Card>
      )}
    </>
  );
}
