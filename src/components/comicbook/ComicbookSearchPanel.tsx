/**
 * ComicbookSearchPanel
 *
 * Embeddable search-and-add component for Western comicbooks. Powered by
 * `comicvine.searchSeries` + `comicvine.addSeries`. Renders only the search
 * input, results grid, and add button — no Container, Title, modal wrapper,
 * or library picker. The caller supplies `libraryId` and the surrounding
 * chrome (page, modal, tab panel, etc.).
 *
 * Used by:
 *   - `/add-comic` page (`AddComicWizard`) — wraps this with a library picker
 *   - `AddMangaModal` Comicbook tab — passes the modal's selected library id
 *
 * Search/add behaviour mirrors the AniList flow in `AddMangaModal`: typing
 * triggers a query, clicking a card adds the series, success closes via
 * `onComplete`. The ComicVine results are mapped into a slim
 * `ComicSeriesSearchHit` shape on the server, so the UI stays small.
 */
import React, { useState } from 'react';

import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Image,
  Loader,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconAlertCircle, IconCheck, IconPlus, IconSearch } from '@tabler/icons-react';

import type { ComicSeriesSearchHit } from '@/server/trpc/routers/comicvine';
import { trpc } from '@/utils/trpc-client/index';

export interface ComicbookSearchPanelProps {
  /** Library to add the series to. */
  libraryId: number;
  /** Called with the new manga id after a successful add. */
  onComplete?: (mangaId: number) => void;
}

function showSuccessToast(message: string): void {
  notifications.show({
    title: 'Comic added',
    message,
    color: 'green',
    icon: <IconCheck size={16} />,
  });
}

function showErrorToast(message: string): void {
  notifications.show({
    title: 'Error',
    message,
    color: 'red',
    icon: <IconAlertCircle size={16} />,
  });
}

export function ComicbookSearchPanel({
  libraryId,
  onComplete,
}: ComicbookSearchPanelProps): React.ReactElement {
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');

  const searchQuery = trpc.comicvine.searchSeries.useQuery(
    { query: submittedQuery, limit: 24 },
    { enabled: submittedQuery.length > 0, staleTime: 60_000 },
  );

  const addMutation = trpc.comicvine.addSeries.useMutation({
    onSuccess: (result) => {
      showSuccessToast(`"${result.title}" added to library`);
      onComplete?.(result.id);
    },
    onError: (err) => showErrorToast(err.message),
  });

  const handleSubmitSearch = (): void => {
    const trimmed = query.trim();
    if (trimmed.length > 0) setSubmittedQuery(trimmed);
  };

  const handleAdd = (hit: ComicSeriesSearchHit): void => {
    addMutation.mutate({ comicvineVolumeId: hit.id, libraryId });
  };

  return (
    <Stack gap="md">
      <Group align="flex-end">
        <TextInput
          label="Series title"
          placeholder="e.g. Saga, Invincible, Sandman"
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmitSearch();
          }}
          leftSection={<IconSearch size={16} />}
          style={{ flex: 1 }}
        />
        <Button onClick={handleSubmitSearch} loading={searchQuery.isFetching}>
          Search
        </Button>
      </Group>
      <SearchResults
        query={searchQuery}
        onAdd={handleAdd}
        isAdding={addMutation.isPending}
        submitted={submittedQuery.length > 0}
      />
    </Stack>
  );
}

interface SearchResultsProps {
  query: ReturnType<typeof trpc.comicvine.searchSeries.useQuery>;
  onAdd: (hit: ComicSeriesSearchHit) => void;
  isAdding: boolean;
  submitted: boolean;
}

function SearchResults({
  query,
  onAdd,
  isAdding,
  submitted,
}: SearchResultsProps): React.ReactElement | null {
  if (!submitted) {
    return (
      <Stack align="center" py="xl">
        <Text c="dimmed" size="sm">Search ComicVine for a Western comicbook series.</Text>
      </Stack>
    );
  }
  if (query.isLoading) {
    return (
      <Group justify="center" py="lg">
        <Loader />
      </Group>
    );
  }
  if (query.error) {
    return (
      <Alert color="red" icon={<IconAlertCircle size={16} />}>
        {query.error.message}
      </Alert>
    );
  }
  const hits = (query.data ?? []) as ComicSeriesSearchHit[];
  if (hits.length === 0) {
    return <Text c="dimmed">No results.</Text>;
  }
  return (
    <SimpleGrid cols={{ base: 2, sm: 3, md: 4, lg: 5 }}>
      {hits.map((hit) => (
        <ResultCard key={hit.id} hit={hit} onAdd={onAdd} disabled={isAdding} />
      ))}
    </SimpleGrid>
  );
}

interface ResultCardProps {
  hit: ComicSeriesSearchHit;
  onAdd: (hit: ComicSeriesSearchHit) => void;
  disabled: boolean;
}

function ResultCard({ hit, onAdd, disabled }: ResultCardProps): React.ReactElement {
  return (
    <Card shadow="sm" radius="md" withBorder padding="sm">
      <Card.Section>
        <Image
          src={hit.coverUrl ?? '/cover-not-found.jpg'}
          alt={hit.name}
          height={240}
          fit="cover"
          fallbackSrc="/cover-not-found.jpg"
        />
      </Card.Section>
      <Stack gap={4} mt="xs">
        <Text fw={600} lineClamp={2}>{hit.name}</Text>
        <Group gap="xs">
          {hit.year !== null && <Badge variant="light" size="xs">{hit.year}</Badge>}
          {hit.publisher && <Badge variant="light" color="grape" size="xs">{hit.publisher}</Badge>}
          {hit.issueCount !== null && (
            <Badge variant="light" color="blue" size="xs">{hit.issueCount} issues</Badge>
          )}
        </Group>
        <Button
          size="xs"
          mt="xs"
          leftSection={<IconPlus size={14} />}
          onClick={() => onAdd(hit)}
          disabled={disabled}
        >
          Add
        </Button>
      </Stack>
    </Card>
  );
}
