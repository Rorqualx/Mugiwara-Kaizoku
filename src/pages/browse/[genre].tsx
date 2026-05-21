/**
 * Genre Browse Page
 *
 * Displays manga filtered by genre from library + AniList discovery.
 * Discover cards open a detail modal with quick-add to library.
 */

import React from 'react';

import {
  Alert, Badge, Center, Container, Group, Image,
  Loader, Paper, SimpleGrid, Stack, Text, Title,
} from '@mantine/core';
import { IconAlertCircle, IconBook, IconStar, IconTags } from '@tabler/icons-react';
import { useRouter } from 'next/router';

import { QuickAddProgressModal } from '@/components/addManga/QuickAddProgressModal';
import { BrowseMangaCard } from '@/components/browse/BrowseMangaCard';
import { MangaDetailModal } from '@/components/home';
import { ResponsiveMainLayout } from '@/components/layouts/ResponsiveMainLayout';
import { useMangaDetailModal } from '@/hooks/useMangaDetailModal';
import { useQuickAddFromModal } from '@/hooks/useQuickAddFromModal';
import type { DiscoverManga } from '@/server/trpc/routers/browse-discover';
import { trpc } from '@/utils/trpc-client';

function DiscoverCard({ manga, onClick }: { manga: DiscoverManga; onClick: () => void }): React.ReactElement {
  const score = manga.averageScore;
  return (
    <Paper shadow="sm" radius="md" style={{ overflow: 'hidden', cursor: 'pointer' }} onClick={onClick}>
      <div style={{ position: 'relative' }}>
        <Image src={manga.cover} alt={manga.title} h={270} fit="cover" />
        {score !== null && score > 0 && (
          <Badge size="sm" variant="filled" color="dark"
            style={{ position: 'absolute', top: 6, right: 6, opacity: 0.9 }}
            leftSection={<IconStar size={10} />}>
            {(score / 10).toFixed(1)}
          </Badge>
        )}
      </div>
      <Stack gap={4} p="xs">
        <Text size="sm" fw={600} lineClamp={2}>{manga.title}</Text>
        <Group gap="xs">
          {manga.status && <Badge size="xs" variant="light" color="blue">{manga.status}</Badge>}
          {manga.year && <Text size="xs" c="dimmed">{manga.year}</Text>}
        </Group>
      </Stack>
    </Paper>
  );
}

export default function GenreBrowsePage(): React.ReactElement {
  const router = useRouter();
  const genre = typeof router.query['genre'] === 'string' ? decodeURIComponent(router.query['genre']) : '';

  const library = trpc.browse.getByGenre.useQuery({ genre, limit: 50 }, { enabled: genre.length > 0 });
  const discover = trpc.discover.searchByGenre.useQuery({ genre, perPage: 30 }, { enabled: genre.length > 0 });

  const { opened, anilistId, openModal, closeModal } = useMangaDetailModal();
  const quickAdd = useQuickAddFromModal(() => void library.refetch());

  const handleAdd = (manga: Parameters<typeof quickAdd.handleAdd>[0]): void => {
    closeModal();
    void quickAdd.handleAdd(manga);
  };

  const libraryTitles = new Set((library.data?.items ?? []).map(m => m.title.toLowerCase()));
  const externalManga = (discover.data?.manga ?? []).filter(m => !libraryTitles.has(m.title.toLowerCase()));
  const isLoading = library.isLoading && discover.isLoading;

  return (
    <ResponsiveMainLayout>
      <Container size="xl" py="xl" pt={80}>
        <Group gap="md" mb="xl">
          <IconTags size={32} />
          <div>
            <Title order={2}>{genre}</Title>
            <Text c="dimmed" size="sm">
              {library.data ? `${library.data.items.length} in library` : ''}
              {discover.data ? ` · ${discover.data.pageInfo.total} on AniList` : ''}
            </Text>
          </div>
        </Group>

        {isLoading && <Center py="xl"><Loader /></Center>}
        {library.error && <Alert icon={<IconAlertCircle size={16} />} color="red" mb="md">{library.error.message}</Alert>}

        {library.data && library.data.items.length > 0 && (
          <>
            <Title order={4} mb="md">In Your Library</Title>
            <SimpleGrid cols={{ base: 2, xs: 3, sm: 4, md: 5, lg: 6 }} mb="xl">
              {library.data.items.map(m => <BrowseMangaCard key={m.id} manga={m} secondaryField="author" />)}
            </SimpleGrid>
          </>
        )}
        {externalManga.length > 0 && (
          <>
            <Title order={4} mb="md">Discover More</Title>
            <SimpleGrid cols={{ base: 2, xs: 3, sm: 4, md: 5, lg: 6 }}>
              {externalManga.map(m => <DiscoverCard key={m.anilistId} manga={m} onClick={() => openModal(m.anilistId)} />)}
            </SimpleGrid>
          </>
        )}
        {!isLoading && (library.data?.items.length ?? 0) === 0 && externalManga.length === 0 && (
          <Center py="xl"><Stack align="center" gap="xs">
            <IconBook size={48} color="gray" /><Text c="dimmed">No manga found with this genre</Text>
          </Stack></Center>
        )}
      </Container>

      <MangaDetailModal opened={opened} anilistId={anilistId} onClose={closeModal} onAdd={handleAdd} />
      <QuickAddProgressModal opened={quickAdd.progressOpened} mangaTitle={quickAdd.progressTitle}
        coverImage={quickAdd.progressCover} progress={quickAdd.progress} onClose={quickAdd.closeProgress} />
    </ResponsiveMainLayout>
  );
}
