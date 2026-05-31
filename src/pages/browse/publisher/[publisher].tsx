/**
 * Publisher Browse Page (Phase 4 v2-C)
 *
 * Displays manga in the library filtered by publisher. Mirrors
 * `/browse/[genre]` shape but without the AniList "Discover" half —
 * AniList doesn't index by publisher cleanly so there's nothing to merge in.
 */

import React from 'react';

import {
  Alert, Center, Container, Group, Loader, SimpleGrid, Stack, Text, Title,
} from '@mantine/core';
import { IconAlertCircle, IconBook, IconBuildingStore } from '@tabler/icons-react';
import { useRouter } from 'next/router';

import { BrowseMangaCard } from '@/components/browse/BrowseMangaCard';
import { ResponsiveMainLayout } from '@/components/layouts/ResponsiveMainLayout';
import { trpc } from '@/utils/trpc-client';

export default function PublisherBrowsePage(): React.ReactElement {
  const router = useRouter();
  const publisher =
    typeof router.query['publisher'] === 'string'
      ? decodeURIComponent(router.query['publisher'])
      : '';

  const library = trpc.browse.getByPublisher.useQuery(
    { publisher, limit: 50 },
    { enabled: publisher.length > 0 },
  );

  const items = library.data?.items ?? [];

  return (
    <ResponsiveMainLayout>
      <Container size="xl" py="xl" pt={80}>
        <Group gap="md" mb="xl">
          <IconBuildingStore size={32} />
          <div>
            <Title order={2}>{publisher}</Title>
            <Text c="dimmed" size="sm">
              {library.data ? `${items.length} in library` : ''}
            </Text>
          </div>
        </Group>

        {library.isLoading && (
          <Center py="xl">
            <Loader />
          </Center>
        )}
        {library.error && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" mb="md">
            {library.error.message}
          </Alert>
        )}

        {items.length > 0 && (
          <SimpleGrid cols={{ base: 2, xs: 3, sm: 4, md: 5, lg: 6 }} mb="xl">
            {items.map((m) => (
              <BrowseMangaCard key={m.id} manga={m} secondaryField="author" />
            ))}
          </SimpleGrid>
        )}

        {!library.isLoading && items.length === 0 && (
          <Center py="xl">
            <Stack align="center" gap="xs">
              <IconBook size={48} color="gray" />
              <Text c="dimmed">No manga found from this publisher</Text>
            </Stack>
          </Center>
        )}
      </Container>
    </ResponsiveMainLayout>
  );
}
