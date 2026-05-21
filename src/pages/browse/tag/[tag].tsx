/**
 * Tag Browse Page
 *
 * Displays manga filtered by tag from AniList.
 * Cards open detail modal with quick-add to library.
 */

import React from 'react';

import {
  Badge, Center, Container, Group, Image,
  Loader, Paper, SimpleGrid, Stack, Text, Title,
} from '@mantine/core';
import { IconBook, IconStar, IconTags } from '@tabler/icons-react';
import { useRouter } from 'next/router';

import { QuickAddProgressModal } from '@/components/addManga/QuickAddProgressModal';
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

export default function TagBrowsePage(): React.ReactElement {
  const router = useRouter();
  const tag = typeof router.query['tag'] === 'string' ? decodeURIComponent(router.query['tag']) : '';

  const { data, isLoading } = trpc.discover.searchByTag.useQuery({ tag, perPage: 30 }, { enabled: tag.length > 0 });
  const { opened, anilistId, openModal, closeModal } = useMangaDetailModal();
  const quickAdd = useQuickAddFromModal();

  const handleAdd = (manga: Parameters<typeof quickAdd.handleAdd>[0]): void => {
    closeModal();
    void quickAdd.handleAdd(manga);
  };

  return (
    <ResponsiveMainLayout>
      <Container size="xl" py="xl" pt={80}>
        <Group gap="md" mb="xl">
          <IconTags size={32} />
          <div>
            <Title order={2}>{tag}</Title>
            <Text c="dimmed" size="sm">
              {data ? `${data.pageInfo.total} results on AniList` : 'Loading...'}
            </Text>
          </div>
        </Group>

        {isLoading && <Center py="xl"><Loader /></Center>}
        {data?.manga.length === 0 && (
          <Center py="xl"><Stack align="center" gap="xs">
            <IconBook size={48} color="gray" /><Text c="dimmed">No manga found with this tag</Text>
          </Stack></Center>
        )}

        <SimpleGrid cols={{ base: 2, xs: 3, sm: 4, md: 5, lg: 6 }}>
          {data?.manga.map(m => <DiscoverCard key={m.anilistId} manga={m} onClick={() => openModal(m.anilistId)} />)}
        </SimpleGrid>
      </Container>

      <MangaDetailModal opened={opened} anilistId={anilistId} onClose={closeModal} onAdd={handleAdd} />
      <QuickAddProgressModal opened={quickAdd.progressOpened} mangaTitle={quickAdd.progressTitle}
        coverImage={quickAdd.progressCover} progress={quickAdd.progress} onClose={quickAdd.closeProgress} />
    </ResponsiveMainLayout>
  );
}
