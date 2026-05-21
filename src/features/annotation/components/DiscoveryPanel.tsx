/**
 * Discovery Panel Component
 *
 * Allows discovering annotation candidates from the manga library.
 */

import React, { useState } from 'react';

import {
  Card,
  Text,
  Button,
  Group,
  Stack,
  Table,
  Checkbox,
  Select,
  Badge,
  Alert,
  Loader,
} from '@mantine/core';
import { IconSearch, IconPlus, IconAlertCircle } from '@tabler/icons-react';

import type { DiscoverableUrl } from '@/server/trpc/routers/annotation';
import { api } from '@/utils/api';

interface DiscoveryPanelProps {
  onAddComplete: () => void;
}

const SOURCE_OPTIONS = [
  { value: '', label: 'All Sources' },
  { value: 'FANDOM', label: 'Fandom' },
  { value: 'WIKIPEDIA', label: 'Wikipedia' },
  { value: 'ANILIST', label: 'AniList' },
  { value: 'COMICVINE', label: 'ComicVine' },
];

export function DiscoveryPanel({ onAddComplete }: DiscoveryPanelProps): React.ReactElement {
  const [sourceFilter, setSourceFilter] = useState<string>('');
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());

  const { data, isLoading, isError, error, refetch } = api.annotation.discoverFromLibrary.useQuery({
    sourceTypes: sourceFilter ? [sourceFilter as 'FANDOM' | 'WIKIPEDIA' | 'ANILIST' | 'COMICVINE'] : undefined,
    limit: 100,
    excludeAnnotated: true,
  });

  const addBulkMutation = api.annotation.addBulkFromDiscovery.useMutation({
    onSuccess: () => {
      setSelectedUrls(new Set());
      void refetch();
      onAddComplete();
    },
  });

  const handleToggleUrl = (url: string): void => {
    setSelectedUrls((prev) => {
      const next = new Set(prev);
      if (next.has(url)) {
        next.delete(url);
      } else {
        next.add(url);
      }
      return next;
    });
  };

  const handleSelectAll = (): void => {
    if (!data?.urls) return;
    if (selectedUrls.size === data.urls.length) {
      setSelectedUrls(new Set());
    } else {
      setSelectedUrls(new Set(data.urls.map((u) => u.url)));
    }
  };

  const handleAddSelected = (): void => {
    if (!data?.urls) return;
    const urlsToAdd = data.urls
      .filter((u) => selectedUrls.has(u.url))
      .map((u) => ({ url: u.url, mangaTitle: u.mangaTitle }));
    addBulkMutation.mutate({ urls: urlsToAdd });
  };

  const getSourceColor = (sourceType: string): string => {
    switch (sourceType) {
      case 'FANDOM': return 'orange';
      case 'WIKIPEDIA': return 'blue';
      case 'ANILIST': return 'cyan';
      case 'COMICVINE': return 'red';
      default: return 'gray';
    }
  };

  return (
    <Card withBorder p="md">
      <Stack gap="md">
        <Group justify="space-between">
          <Text fw={500}>Discover URLs from Library</Text>
          <Button
            size="xs"
            variant="light"
            leftSection={<IconSearch size={14} />}
            onClick={() => void refetch()}
            loading={isLoading}
          >
            Scan Library
          </Button>
        </Group>

        <Group>
          <Select
            placeholder="Filter by source"
            data={SOURCE_OPTIONS}
            value={sourceFilter}
            onChange={(v) => setSourceFilter(v ?? '')}
            size="xs"
            w={150}
          />
          <Text size="xs" c="dimmed">
            {data?.total ?? 0} URLs found
            {data?.alreadyAnnotatedCount ? ` (${data.alreadyAnnotatedCount} already annotated)` : ''}
          </Text>
        </Group>

        {isError && (
          <Alert icon={<IconAlertCircle size={16} />} color="red">
            {error.message}
          </Alert>
        )}

        {isLoading ? (
          <Group justify="center" py="xl">
            <Loader size="sm" />
          </Group>
        ) : data?.urls && data.urls.length > 0 ? (
          <>
            <Table.ScrollContainer minWidth={500}>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th w={40}>
                      <Checkbox
                        checked={selectedUrls.size === data.urls.length && data.urls.length > 0}
                        indeterminate={selectedUrls.size > 0 && selectedUrls.size < data.urls.length}
                        onChange={handleSelectAll}
                      />
                    </Table.Th>
                    <Table.Th>Manga</Table.Th>
                    <Table.Th>Source</Table.Th>
                    <Table.Th>URL</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {data.urls.map((item) => (
                    <DiscoveryRow
                      key={item.url}
                      item={item}
                      isSelected={selectedUrls.has(item.url)}
                      onToggle={() => handleToggleUrl(item.url)}
                      getSourceColor={getSourceColor}
                    />
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>

            <Group justify="space-between">
              <Text size="sm">{selectedUrls.size} selected</Text>
              <Button
                leftSection={<IconPlus size={14} />}
                disabled={selectedUrls.size === 0}
                loading={addBulkMutation.isPending}
                onClick={handleAddSelected}
              >
                Add Selected ({selectedUrls.size})
              </Button>
            </Group>

            {addBulkMutation.data && (
              <Alert color="green">
                Added {addBulkMutation.data.added} pages
                {addBulkMutation.data.skipped > 0 && `, skipped ${addBulkMutation.data.skipped} duplicates`}
                {addBulkMutation.data.failed.length > 0 && `, ${addBulkMutation.data.failed.length} failed`}
              </Alert>
            )}
          </>
        ) : (
          <Text size="sm" c="dimmed" ta="center" py="xl">
            No discoverable URLs found. Add manga to your library with external links.
          </Text>
        )}
      </Stack>
    </Card>
  );
}

function DiscoveryRow({
  item,
  isSelected,
  onToggle,
  getSourceColor,
}: {
  item: DiscoverableUrl;
  isSelected: boolean;
  onToggle: () => void;
  getSourceColor: (s: string) => string;
}): React.ReactElement {
  return (
    <Table.Tr>
      <Table.Td>
        <Checkbox checked={isSelected} onChange={onToggle} />
      </Table.Td>
      <Table.Td>
        <Text size="sm" lineClamp={1}>
          {item.mangaTitle}
        </Text>
      </Table.Td>
      <Table.Td>
        <Badge size="xs" color={getSourceColor(item.sourceType)}>
          {item.sourceType}
        </Badge>
      </Table.Td>
      <Table.Td>
        <Text size="xs" c="dimmed" lineClamp={1}>
          {item.url}
        </Text>
      </Table.Td>
    </Table.Tr>
  );
}
