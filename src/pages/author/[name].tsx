/**
 * Author Page
 *
 * Displays manga by a specific author from both local library
 * and AniList bibliography. Discover cards open a detail modal
 * with quick-add to library.
 */

import React from 'react';

import {
  Alert, Avatar, Badge, Center, Container, Group, Image,
  Loader, Paper, SimpleGrid, Stack, Text, Title,
} from '@mantine/core';
import { IconAlertCircle, IconBook, IconStar, IconUser } from '@tabler/icons-react';
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

export default function AuthorPage(): React.ReactElement {
  const router = useRouter();
  const name = typeof router.query['name'] === 'string' ? decodeURIComponent(router.query['name']) : '';

  const library = trpc.browse.getByAuthor.useQuery({ author: name, limit: 50 }, { enabled: name.length > 0 });
  const bibliography = trpc.discover.getAuthorBibliography.useQuery({ name }, { enabled: name.length > 0 });

  const { opened, anilistId, openModal, closeModal } = useMangaDetailModal();
  const quickAdd = useQuickAddFromModal(() => void library.refetch());

  const handleAdd = (manga: Parameters<typeof quickAdd.handleAdd>[0]): void => {
    closeModal();
    void quickAdd.handleAdd(manga);
  };

  const libraryIds = new Set((library.data?.items ?? []).map(m => m.title.toLowerCase()));
  const externalManga = (bibliography.data?.manga ?? []).filter(m => !libraryIds.has(m.title.toLowerCase()));
  const isLoading = library.isLoading && bibliography.isLoading;

  return (
    <ResponsiveMainLayout>
      <Container size="xl" py="xl" pt={80}>
        <Group gap="md" mb="xl" align="flex-start">
          {bibliography.data?.image
            ? <Avatar src={bibliography.data.image} size={64} radius="xl" />
            : <IconUser size={32} />}
          <div>
            <Title order={2}>{bibliography.data?.name ?? name}</Title>
            {bibliography.data?.nativeName && <Text size="sm" c="dimmed">{bibliography.data.nativeName}</Text>}
            <Text size="sm" c="dimmed">
              {library.data ? `${library.data.items.length} in library` : ''}
              {bibliography.data ? ` · ${bibliography.data.manga.length} total works` : ''}
            </Text>
          </div>
        </Group>

        {isLoading && <Center py="xl"><Loader /></Center>}
        {library.error && <Alert icon={<IconAlertCircle size={16} />} color="red" mb="md">{library.error.message}</Alert>}

        {library.data && library.data.items.length > 0 && (
          <AuthorSection title="In Your Library" items={library.data.items} />
        )}
        {externalManga.length > 0 && (
          <DiscoverSection title="Other Works" items={externalManga} onCardClick={openModal} />
        )}
        {!isLoading && (library.data?.items.length ?? 0) === 0 && externalManga.length === 0 && (
          <Center py="xl"><Stack align="center" gap="xs">
            <IconBook size={48} color="gray" /><Text c="dimmed">No manga found for this author</Text>
          </Stack></Center>
        )}
      </Container>

      <MangaDetailModal opened={opened} anilistId={anilistId} onClose={closeModal} onAdd={handleAdd} />
      <QuickAddProgressModal opened={quickAdd.progressOpened} mangaTitle={quickAdd.progressTitle}
        coverImage={quickAdd.progressCover} progress={quickAdd.progress} onClose={quickAdd.closeProgress} />
    </ResponsiveMainLayout>
  );
}

function AuthorSection({ title, items }: { title: string; items: Array<{ id: number; title: string; Metadata: unknown }> }): React.ReactElement {
  return (
    <>
      <Title order={4} mb="md">{title}</Title>
      <SimpleGrid cols={{ base: 2, xs: 3, sm: 4, md: 5, lg: 6 }} mb="xl">
        {items.map(m => <BrowseMangaCard key={m.id} manga={m as Parameters<typeof BrowseMangaCard>[0]['manga']} secondaryField="publisher" />)}
      </SimpleGrid>
    </>
  );
}

function DiscoverSection({ title, items, onCardClick }: { title: string; items: DiscoverManga[]; onCardClick: (id: number) => void }): React.ReactElement {
  return (
    <>
      <Title order={4} mb="md">{title}</Title>
      <SimpleGrid cols={{ base: 2, xs: 3, sm: 4, md: 5, lg: 6 }}>
        {items.map(m => <DiscoverCard key={m.anilistId} manga={m} onClick={() => onCardClick(m.anilistId)} />)}
      </SimpleGrid>
    </>
  );
}
