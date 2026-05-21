/**
 * GetComicsModal — search GetComics for a comicbook series and queue a
 * download for the matched issue. Opened from the comicbook detail page.
 *
 * Three steps inside the modal:
 *   1. Search — auto-runs when modal opens, seeded from manga title.
 *   2. Pick a release — grid of search hits.
 *   3. Pick a host link — list of DDL hosts; clicking queues the download.
 *
 * The mutation rejects when `comicvine.comicbookTrackingEnabled` is off,
 * but we also gate the modal trigger client-side so users don't reach this
 * surface unless the feature is on.
 */

import React, { useEffect, useState } from 'react';

import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Image,
  Loader,
  Modal,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconAlertCircle,
  IconArrowLeft,
  IconCheck,
  IconDownload,
  IconExternalLink,
  IconSearch,
} from '@tabler/icons-react';

import { useDismissibleNotice } from '@/hooks/useDismissibleNotice';
import { trpc } from '@/utils/trpc-client/index';

interface GetComicsModalProps {
  opened: boolean;
  onClose: () => void;
  mangaId: number;
  mangaTitle: string;
  /** Optional issue number to use in the download path. */
  issueNumber?: number | null;
}

interface SearchHit {
  id: string;
  title: string;
  detailUrl: string;
  coverUrl: string | null;
  format: string | null;
  year: number | null;
  description: string | null;
}

function showToast(title: string, message: string, ok: boolean): void {
  notifications.show({
    title,
    message,
    color: ok ? 'green' : 'red',
    icon: ok ? <IconCheck size={16} /> : <IconAlertCircle size={16} />,
  });
}

const TRUST_NOTICE_KEY = 'getcomics-content-trust-v1';

function ContentTrustAlert(): React.ReactElement | null {
  const { dismissed, dismiss } = useDismissibleNotice(TRUST_NOTICE_KEY);
  if (dismissed) return null;
  return (
    <Alert
      color="yellow"
      icon={<IconAlertCircle size={16} />}
      title="Third-party content"
      withCloseButton
      onClose={dismiss}
      mb="sm"
    >
      <Text size="sm">
        GetComics aggregates third-party download links (mediafire, mega, direct mirrors).
        Files are downloaded without virus scanning or content review. Inspect downloads
        before opening.
      </Text>
      <Button variant="subtle" size="xs" mt="xs" onClick={dismiss}>
        Don&apos;t show again
      </Button>
    </Alert>
  );
}

export function GetComicsModal({
  opened, onClose, mangaId, mangaTitle, issueNumber,
}: GetComicsModalProps): React.ReactElement {
  const [query, setQuery] = useState(mangaTitle);
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [pickedHit, setPickedHit] = useState<SearchHit | null>(null);

  // Seed the query when modal opens
  useEffect(() => {
    if (opened) {
      setQuery(mangaTitle);
      setSubmittedQuery(mangaTitle);
      setPickedHit(null);
    }
  }, [opened, mangaTitle]);

  const searchQuery = trpc.getcomics.search.useQuery(
    { query: submittedQuery, page: 1, context: 'comicbook' },
    { enabled: opened && submittedQuery.length > 0, staleTime: 60_000 },
  );

  const linksQuery = trpc.getcomics.getDownloadLinks.useQuery(
    { detailUrl: pickedHit?.detailUrl ?? '' },
    { enabled: opened && Boolean(pickedHit), staleTime: 60_000 },
  );

  const queueMutation = trpc.getcomics.queueDownload.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        showToast('Download queued', result.message, true);
        onClose();
      } else {
        showToast('Queue failed', result.message, false);
      }
    },
    onError: (err) => showToast('Queue failed', err.message, false),
  });

  const handleSubmit = (): void => {
    const trimmed = query.trim();
    if (trimmed.length > 0) setSubmittedQuery(trimmed);
  };

  const handlePickHit = (hit: SearchHit): void => setPickedHit(hit);
  const handleBack = (): void => setPickedHit(null);

  const handleQueue = (host: string, downloadUrl: string): void => {
    if (!pickedHit) return;
    queueMutation.mutate({
      mangaId,
      detailUrl: pickedHit.detailUrl,
      downloadUrl,
      host,
      title: pickedHit.title,
      ...(typeof issueNumber === 'number' ? { chapterNumber: issueNumber } : {}),
    });
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Find on GetComics" size="xl" centered>
      <ContentTrustAlert />
      {pickedHit ? (
        <LinksView
          hit={pickedHit}
          query={linksQuery}
          onBack={handleBack}
          onQueue={handleQueue}
          isQueueing={queueMutation.isPending}
        />
      ) : (
        <SearchView
          query={query}
          onQueryChange={setQuery}
          onSubmit={handleSubmit}
          searchQuery={searchQuery}
          submitted={submittedQuery.length > 0}
          onPickHit={handlePickHit}
        />
      )}
    </Modal>
  );
}

interface SearchViewProps {
  query: string;
  onQueryChange: (v: string) => void;
  onSubmit: () => void;
  searchQuery: ReturnType<typeof trpc.getcomics.search.useQuery>;
  submitted: boolean;
  onPickHit: (h: SearchHit) => void;
}

function SearchView(props: SearchViewProps): React.ReactElement {
  const { query, onQueryChange, onSubmit, searchQuery, submitted, onPickHit } = props;
  return (
    <Stack gap="md">
      <Group align="flex-end">
        <TextInput
          label="Search GetComics"
          value={query}
          onChange={(e) => onQueryChange(e.currentTarget.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onSubmit(); }}
          leftSection={<IconSearch size={16} />}
          style={{ flex: 1 }}
        />
        <Button onClick={onSubmit} loading={searchQuery.isFetching}>Search</Button>
      </Group>
      <SearchResults query={searchQuery} submitted={submitted} onPickHit={onPickHit} />
    </Stack>
  );
}

interface SearchResultsProps {
  query: ReturnType<typeof trpc.getcomics.search.useQuery>;
  submitted: boolean;
  onPickHit: (h: SearchHit) => void;
}

function SearchResults({ query, submitted, onPickHit }: SearchResultsProps): React.ReactElement | null {
  if (!submitted) return null;
  if (query.isLoading) return <Group justify="center"><Loader /></Group>;
  if (query.error) {
    return <Alert color="red" icon={<IconAlertCircle size={16} />}>{query.error.message}</Alert>;
  }
  const data = query.data as { results?: SearchHit[] } | undefined;
  const hits = (data?.results ?? []) as SearchHit[];
  if (hits.length === 0) return <Text c="dimmed">No results.</Text>;
  return (
    <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
      {hits.map((hit) => <ResultCard key={hit.id} hit={hit} onPick={onPickHit} />)}
    </SimpleGrid>
  );
}

interface ResultCardProps {
  hit: SearchHit;
  onPick: (h: SearchHit) => void;
}

function ResultCard({ hit, onPick }: ResultCardProps): React.ReactElement {
  return (
    <Card withBorder padding="sm" radius="md">
      <Card.Section>
        <Image
          src={hit.coverUrl ?? '/cover-not-found.jpg'}
          alt={hit.title}
          height={200}
          fit="cover"
          fallbackSrc="/cover-not-found.jpg"
        />
      </Card.Section>
      <Stack gap={4} mt="xs">
        <Text fw={600} size="sm" lineClamp={2}>{hit.title}</Text>
        <Group gap="xs">
          {hit.year !== null && <Badge size="xs" variant="light">{hit.year}</Badge>}
          {hit.format && <Badge size="xs" variant="light" color="blue">{hit.format}</Badge>}
        </Group>
        <Button size="xs" mt="xs" variant="light" onClick={() => onPick(hit)}>
          View hosts
        </Button>
      </Stack>
    </Card>
  );
}

interface LinksViewProps {
  hit: SearchHit;
  query: ReturnType<typeof trpc.getcomics.getDownloadLinks.useQuery>;
  onBack: () => void;
  onQueue: (host: string, url: string) => void;
  isQueueing: boolean;
}

function LinksView({ hit, query, onBack, onQueue, isQueueing }: LinksViewProps): React.ReactElement {
  return (
    <Stack gap="md">
      <Group justify="space-between" align="center">
        <Group>
          <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={onBack}>
            Back to results
          </Button>
          <Text fw={600}>{hit.title}</Text>
        </Group>
        <Button
          component="a"
          variant="subtle"
          rightSection={<IconExternalLink size={14} />}
          href={hit.detailUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          GetComics page
        </Button>
      </Group>
      <LinksList query={query} onQueue={onQueue} isQueueing={isQueueing} />
    </Stack>
  );
}

interface LinksListProps {
  query: ReturnType<typeof trpc.getcomics.getDownloadLinks.useQuery>;
  onQueue: (host: string, url: string) => void;
  isQueueing: boolean;
}

function LinksList({ query, onQueue, isQueueing }: LinksListProps): React.ReactElement {
  if (query.isLoading) return <Group justify="center"><Loader /></Group>;
  if (query.error) {
    return <Alert color="red" icon={<IconAlertCircle size={16} />}>{query.error.message}</Alert>;
  }
  interface LinkRow {
    host: string;
    url: string;
    label: string;
    isMirror: boolean;
  }
  const data = query.data as { links?: LinkRow[] } | undefined;
  const links = (data?.links ?? []) as LinkRow[];
  if (links.length === 0) {
    return <Alert color="yellow" icon={<IconAlertCircle size={16} />}>No download hosts found on this release.</Alert>;
  }
  return (
    <Stack gap="xs">
      {links.map((link: LinkRow, idx: number) => (
        <Card key={`${link.url}-${idx}`} withBorder padding="sm">
          <Group justify="space-between">
            <Group gap="sm">
              <Badge variant="light">{link.host}</Badge>
              <Text size="sm">{link.label || link.host}</Text>
              {link.isMirror && <Badge size="xs" variant="light" color="gray">mirror</Badge>}
            </Group>
            <Button
              size="xs"
              leftSection={<IconDownload size={14} />}
              onClick={() => onQueue(link.host, link.url)}
              loading={isQueueing}
            >
              Queue
            </Button>
          </Group>
        </Card>
      ))}
    </Stack>
  );
}
