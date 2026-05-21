/**
 * Training Data Table Component
 *
 * Displays training data entries from CSV with all columns:
 * - Title, AniListID
 * - WikipediaURL, FandomURL, ComicVineID
 * - FandomDiscoveredURLs, WikipediaDiscoveredURLs, ComicVineDiscoveredURLs
 */

import React, { useState, useMemo } from 'react';

import {
  Table,
  Text,
  Badge,
  Group,
  Stack,
  TextInput,
  Select,
  Paper,
  LoadingOverlay,
  Alert,
  Tooltip,
  Anchor,
  UnstyledButton,
  Box,
  ScrollArea,
} from '@mantine/core';
import {
  IconSearch,
  IconChevronDown,
  IconChevronRight,
  IconExternalLink,
  IconDatabase,
  IconWorldWww,
} from '@tabler/icons-react';

import { api } from '@/utils/api';

// ============================================================================
// Types
// ============================================================================

interface DiscoveredUrl {
  type: string;
  url: string;
  categoryName?: string | undefined;
}

interface TrainingEntry {
  title: string;
  anilistId: number | null;
  wikipediaUrl: string | null;
  fandomUrl: string | null;
  comicVineId: string | null;
  fandomDiscoveredUrls: DiscoveredUrl[];
  wikipediaDiscoveredUrls: DiscoveredUrl[];
  comicVineDiscoveredUrls: DiscoveredUrl[];
}

// ============================================================================
// Helper Components
// ============================================================================

function UrlBadge({ url, color }: { url: string; color: string }): React.ReactElement {
  const shortUrl = useMemo(() => {
    try {
      const parsed = new URL(url);
      const path = parsed.pathname;
      if (path.length > 40) {
        return `${parsed.hostname}${path.slice(0, 37)}...`;
      }
      return `${parsed.hostname}${path}`;
    } catch {
      return url.length > 50 ? `${url.slice(0, 47)}...` : url;
    }
  }, [url]);

  return (
    <Tooltip label={url} multiline maw={400}>
      <Anchor href={url} target="_blank" size="xs" c={color}>
        <Group gap={4} wrap="nowrap">
          <IconExternalLink size={12} />
          <Text size="xs" truncate="end" maw={200}>
            {shortUrl}
          </Text>
        </Group>
      </Anchor>
    </Tooltip>
  );
}

function DiscoveredUrlsList({
  urls,
  color,
  maxDisplay = 3,
}: {
  urls: DiscoveredUrl[];
  color: string;
  maxDisplay?: number;
}): React.ReactElement {
  const [expanded, setExpanded] = useState(false);

  if (urls.length === 0) {
    return <Text size="xs" c="dimmed">-</Text>;
  }

  const displayUrls = expanded ? urls : urls.slice(0, maxDisplay);
  const hasMore = urls.length > maxDisplay;

  return (
    <Stack gap={2}>
      {displayUrls.map((discovered, idx) => (
        <Group key={`${discovered.url}-${idx}`} gap={4} wrap="nowrap">
          <Badge size="xs" variant="dot" color={color}>
            {discovered.type}
          </Badge>
          <UrlBadge url={discovered.url} color={color} />
        </Group>
      ))}
      {hasMore && (
        <UnstyledButton onClick={() => setExpanded(!expanded)}>
          <Text size="xs" c="blue">
            {expanded ? 'Show less' : `+${urls.length - maxDisplay} more`}
          </Text>
        </UnstyledButton>
      )}
    </Stack>
  );
}

function DiscoveredUrlsSection({
  entry,
}: {
  entry: TrainingEntry;
}): React.ReactElement {
  return (
    <Box p="sm">
      <Group align="flex-start" gap="xl">
        {entry.fandomDiscoveredUrls.length > 0 && (
          <Stack gap={4}>
            <Group gap={4}>
              <IconWorldWww size={14} />
              <Text size="xs" fw={600} c="orange">Fandom Discovered</Text>
            </Group>
            <DiscoveredUrlsList urls={entry.fandomDiscoveredUrls} color="orange" maxDisplay={5} />
          </Stack>
        )}
        {entry.wikipediaDiscoveredUrls.length > 0 && (
          <Stack gap={4}>
            <Group gap={4}>
              <IconWorldWww size={14} />
              <Text size="xs" fw={600} c="blue">Wikipedia Discovered</Text>
            </Group>
            <DiscoveredUrlsList urls={entry.wikipediaDiscoveredUrls} color="blue" maxDisplay={5} />
          </Stack>
        )}
        {entry.comicVineDiscoveredUrls.length > 0 && (
          <Stack gap={4}>
            <Group gap={4}>
              <IconDatabase size={14} />
              <Text size="xs" fw={600} c="red">ComicVine Discovered</Text>
            </Group>
            <DiscoveredUrlsList urls={entry.comicVineDiscoveredUrls} color="red" maxDisplay={5} />
          </Stack>
        )}
      </Group>
    </Box>
  );
}

// ============================================================================
// Row Component
// ============================================================================

function TrainingRow({ entry }: { entry: TrainingEntry }): React.ReactElement {
  const [expanded, setExpanded] = useState(false);

  const hasDiscoveredUrls =
    entry.fandomDiscoveredUrls.length > 0 ||
    entry.wikipediaDiscoveredUrls.length > 0 ||
    entry.comicVineDiscoveredUrls.length > 0;

  return (
    <>
      <Table.Tr>
        <Table.Td style={{ minWidth: 180 }}>
          <Group gap={4} wrap="nowrap">
            {hasDiscoveredUrls && (
              <UnstyledButton onClick={() => setExpanded(!expanded)}>
                {expanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
              </UnstyledButton>
            )}
            <Text size="sm" fw={500} truncate="end" maw={160}>{entry.title}</Text>
          </Group>
        </Table.Td>
        <Table.Td style={{ width: 90 }}>
          {entry.anilistId ? (
            <Anchor href={`https://anilist.co/manga/${entry.anilistId}`} target="_blank" size="xs">
              {entry.anilistId}
            </Anchor>
          ) : (
            <Text size="xs" c="dimmed">-</Text>
          )}
        </Table.Td>
        <Table.Td style={{ width: 100 }}>
          {entry.comicVineId ? (
            <Anchor href={`https://comicvine.gamespot.com/volume/${entry.comicVineId}/`} target="_blank" size="xs">
              <Badge size="xs" color="red" variant="light">{entry.comicVineId}</Badge>
            </Anchor>
          ) : (
            <Text size="xs" c="dimmed">-</Text>
          )}
        </Table.Td>
        <Table.Td style={{ maxWidth: 200 }}>
          {entry.fandomUrl ? <UrlBadge url={entry.fandomUrl} color="orange" /> : <Text size="xs" c="dimmed">-</Text>}
        </Table.Td>
        <Table.Td style={{ maxWidth: 200 }}>
          {entry.wikipediaUrl ? <UrlBadge url={entry.wikipediaUrl} color="blue" /> : <Text size="xs" c="dimmed">-</Text>}
        </Table.Td>
        <Table.Td style={{ width: 120 }}>
          <Group gap={4}>
            {entry.fandomDiscoveredUrls.length > 0 && (
              <Badge size="xs" color="orange" variant="light">F: {entry.fandomDiscoveredUrls.length}</Badge>
            )}
            {entry.wikipediaDiscoveredUrls.length > 0 && (
              <Badge size="xs" color="blue" variant="light">W: {entry.wikipediaDiscoveredUrls.length}</Badge>
            )}
            {entry.comicVineDiscoveredUrls.length > 0 && (
              <Badge size="xs" color="red" variant="light">C: {entry.comicVineDiscoveredUrls.length}</Badge>
            )}
          </Group>
        </Table.Td>
      </Table.Tr>
      {expanded && hasDiscoveredUrls && (
        <Table.Tr>
          <Table.Td colSpan={6} style={{ backgroundColor: 'var(--mantine-color-dark-7)' }}>
            <DiscoveredUrlsSection entry={entry} />
          </Table.Td>
        </Table.Tr>
      )}
    </>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function TrainingDataTable(): React.ReactElement {
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('all');

  const searchParam = searchQuery.trim() !== '' ? searchQuery : undefined;
  const { data, isLoading, isError, error } = api.annotation.getTrainingDataEntries.useQuery({
    limit: 500,
    source: sourceFilter as 'all' | 'fandom' | 'wikipedia' | 'comicvine',
    search: searchParam,
  });

  return (
    <Stack>
      {isError && (
        <Alert color="red" variant="light">
          <Text size="sm">Failed to load training data: {error.message}</Text>
        </Alert>
      )}
      <Group>
        <TextInput
          placeholder="Search by title..."
          leftSection={<IconSearch size={16} />}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.currentTarget.value)}
          style={{ flex: 1 }}
        />
        <Select
          placeholder="Source"
          data={[
            { value: 'all', label: 'All Sources' },
            { value: 'fandom', label: 'Fandom' },
            { value: 'wikipedia', label: 'Wikipedia' },
            { value: 'comicvine', label: 'ComicVine' },
          ]}
          value={sourceFilter}
          onChange={(v) => setSourceFilter(v ?? 'all')}
          w={150}
        />
        <Text size="sm" c="dimmed">{data?.total ?? 0} entries</Text>
      </Group>
      <Paper withBorder pos="relative">
        {isLoading && <LoadingOverlay visible />}
        <ScrollArea h={500}>
          <Table highlightOnHover striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Title</Table.Th>
                <Table.Th>AniList ID</Table.Th>
                <Table.Th>ComicVine ID</Table.Th>
                <Table.Th>Fandom URL</Table.Th>
                <Table.Th>Wikipedia URL</Table.Th>
                <Table.Th>Discovered</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {(!data?.entries || data.entries.length === 0) && !isLoading ? (
                <Table.Tr>
                  <Table.Td colSpan={6}>
                    <Text ta="center" c="dimmed" py="xl">
                      No training data entries found. Load a CSV file first.
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                data?.entries.map((entry, idx) => <TrainingRow key={`${entry.title}-${idx}`} entry={entry} />)
              )}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Paper>
      {data?.hasMore && (
        <Text size="xs" c="dimmed" ta="center">
          Showing first {data.entries.length} of {data.total} entries
        </Text>
      )}
    </Stack>
  );
}
