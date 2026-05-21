/**
 * Publisher Page
 *
 * Displays all manga in the library from a specific publisher.
 * Linked from manga detail metadata section.
 */

import React from 'react';

import {
  Alert, Center, Container, Loader, SimpleGrid, Stack, Text, Title, Group,
} from '@mantine/core';
import { IconAlertCircle, IconBook, IconBooks } from '@tabler/icons-react';
import { useRouter } from 'next/router';

import { BrowseMangaCard } from '@/components/browse/BrowseMangaCard';
import { ResponsiveMainLayout } from '@/components/layouts/ResponsiveMainLayout';
import { trpc } from '@/utils/trpc-client';

export default function PublisherPage(): React.ReactElement {
  const router = useRouter();
  const name = typeof router.query['name'] === 'string' ? decodeURIComponent(router.query['name']) : '';

  const { data, isLoading, error } = trpc.browse.getByPublisher.useQuery(
    { publisher: name, limit: 50 },
    { enabled: name.length > 0 },
  );

  return (
    <ResponsiveMainLayout>
      <Container size="xl" py="xl" pt={80}>
        <Group gap="md" mb="xl">
          <IconBooks size={32} />
          <div>
            <Title order={2}>{name}</Title>
            <Text c="dimmed" size="sm">
              {data ? `${data.items.length} title${data.items.length !== 1 ? 's' : ''} in library` : 'Loading...'}
            </Text>
          </div>
        </Group>

        {isLoading && <Center py="xl"><Loader /></Center>}

        {error && (
          <Alert icon={<IconAlertCircle size={16} />} title="Error loading publisher" color="red" mb="md">
            {error.message}
          </Alert>
        )}

        {data?.items.length === 0 && (
          <Center py="xl">
            <Stack align="center" gap="xs">
              <IconBook size={48} color="gray" />
              <Text c="dimmed">No manga found from this publisher in your library</Text>
            </Stack>
          </Center>
        )}

        <SimpleGrid cols={{ base: 2, xs: 3, sm: 4, md: 5, lg: 6 }}>
          {data?.items.map(manga => (
            <BrowseMangaCard key={manga.id} manga={manga} secondaryField="author" />
          ))}
        </SimpleGrid>
      </Container>
    </ResponsiveMainLayout>
  );
}
