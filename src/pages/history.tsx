import React, { useState } from 'react';

import {
  Container,
  Title,
  Card,
  Grid,
  Stack,
  Group,
  Text,
  Badge,
  ActionIcon,
  Button,
  Select,
  TextInput,
  Pagination,
  Menu,
  Loader,
  Center,
  Alert,
  SimpleGrid,
  Paper } from
'@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { showNotification } from '@mantine/notifications';
import {
  IconSearch,
  IconRefresh,
  IconTrash,
  IconDotsVertical,
  IconFileDownload,
  IconAlertCircle } from
'@tabler/icons-react';
import { IconClock } from '@tabler/icons-react';

import { mapToMangaStatus } from '../utils/status-mapper';

interface HistoryFilters {
  search: string;
  status: string;
  dateFrom: string;
  dateTo: string;
  mangaId?: number;
}

export default function HistoryPage(): React.ReactElement {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<HistoryFilters>({
    search: '',
    status: 'all',
    dateFrom: '',
    dateTo: ''
  });

  const [_debouncedSearch] = useDebouncedValue(filters.search, 300);

  // Mock data for now - replace with actual tRPC queries when available
  const historyQuery = {
    data: {
      items: [
      {
        id: '1',
        mangaTitle: 'One Piece',
        chapterTitle: 'Chapter 1100',
        status: 'COMPLETED',
        downloadedAt: new Date(),
        size: '45 MB',
        source: 'AniList'
      }],

      total: 1,
      page: 1,
      totalPages: 1
    },
    isLoading: false,
    isError: false,
    refetch: () => {}
  };

  const statsQuery = {
    data: {
      totalDownloads: 1250,
      successfulDownloads: 1200,
      failedDownloads: 50,
      totalSize: '15.2 GB'
    },
    isLoading: false
  };

  const clearHistoryMutation = {
    mutate: () => {
      showNotification({
        title: 'History Cleared',
        message: 'Download history has been cleared',
        color: 'green'
      });
    },
    isPending: false
  };

  const deleteItemMutation = {
    mutate: (_id: string) => {
      showNotification({
        title: 'Item Deleted',
        message: 'History item has been removed',
        color: 'green'
      });
    }
  };

  const retryDownloadMutation = {
    mutate: (_id: string) => {
      showNotification({
        title: 'Retry Started',
        message: 'Download has been queued for retry',
        color: 'blue'
      });
    }
  };

  const handleClearHistory = (): void => {
    if (confirm('Are you sure you want to clear all download history?')) {
      clearHistoryMutation.mutate();
    }
  };

  const getStatusColor = (status: string): string => {
    return mapToMangaStatus(status);
  };

  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleString();
  };

  const exportHistory = (): void => {
    // Mock export functionality
    const data = JSON.stringify(historyQuery.data?.items ?? [], null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `download-history-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    showNotification({
      title: 'Export Complete',
      message: 'Download history has been exported',
      color: 'green'
    });
  };

  return (
    <Container size="xl">
      <Stack gap="lg">
        {/* Header */}
        <Group justify="space-between" mb="xl">
          <div>
            <Group gap="sm">
              <IconClock size={32} />
              <Title order={1}>Download History</Title>
            </Group>
            <Text c="dimmed" size="sm" mt="xs">
              Track and manage your manga download history
            </Text>
          </div>
          <Group>
            <Button
              variant="subtle"
              leftSection={<IconRefresh size={20} />}
              onClick={() => historyQuery.refetch()}>

              Refresh
            </Button>
            <Button
              variant="light"
              color="red"
              leftSection={<IconTrash size={20} />}
              onClick={handleClearHistory}
              loading={clearHistoryMutation.isPending}>

              Clear History
            </Button>
          </Group>
        </Group>

        {/* Statistics */}
        {statsQuery.data &&
        <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} mb="lg">
            <Paper p="md" radius="md" withBorder>
              <Text c="dimmed" size="xs" tt="uppercase" fw={700}>
                Total Downloads
              </Text>
              <Text size="xl" fw={700}>{statsQuery.data.totalDownloads}</Text>
            </Paper>
            <Paper p="md" radius="md" withBorder>
              <Text c="dimmed" size="xs" tt="uppercase" fw={700}>
                Successful
              </Text>
              <Text size="xl" fw={700} c="green">{statsQuery.data.successfulDownloads}</Text>
            </Paper>
            <Paper p="md" radius="md" withBorder>
              <Text c="dimmed" size="xs" tt="uppercase" fw={700}>
                Failed
              </Text>
              <Text size="xl" fw={700} c="red">{statsQuery.data.failedDownloads}</Text>
            </Paper>
            <Paper p="md" radius="md" withBorder>
              <Text c="dimmed" size="xs" tt="uppercase" fw={700}>
                Total Size
              </Text>
              <Text size="xl" fw={700}>{statsQuery.data.totalSize}</Text>
            </Paper>
          </SimpleGrid>
        }

        {/* Filters */}
        <Card withBorder p="md">
          <Grid>
            <Grid.Col span={{ base: 12, md: 4 }}>
              <TextInput
                style={{ flex: 1 }}
                placeholder="Search by manga or chapter name..."
                leftSection={<IconSearch size={16} />}
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })} />

            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 2 }}>
              <Select
                placeholder="Status"
                value={filters["status"]}
                onChange={(value) => setFilters({ ...filters, status: value ?? 'all' })}
                data={[
                { value: 'all', label: 'All Status' },
                { value: 'completed', label: 'Completed' },
                { value: 'failed', label: 'Failed' },
                { value: 'in_progress', label: 'In Progress' }]
                } />

            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 3 }}>
              <TextInput
                placeholder="From date (YYYY-MM-DD)"
                value={filters.dateFrom}
                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })} />

            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 3 }}>
              <TextInput
                placeholder="To date (YYYY-MM-DD)"
                value={filters.dateTo}
                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })} />

            </Grid.Col>
          </Grid>
        </Card>

        {/* History List */}
        {historyQuery.isLoading ?
        <Center py="xl">
            <Loader size="lg" />
          </Center> :
        historyQuery.isError ?
        <Alert icon={<IconAlertCircle size={16} />} color="red">
            Failed to load download history. Please try again.
          </Alert> :
        historyQuery.data?.items.length === 0 ?
        <Card withBorder p="xl">
            <Center>
              <Stack align="center" gap="md">
                <IconClock size={48} stroke={1.5} style={{ opacity: 0.5 }} />
                <div>
                  <Text size="lg" fw={500} ta="center">No download history</Text>
                  <Text size="sm" c="dimmed" ta="center">
                    Your download history will appear here
                  </Text>
                </div>
              </Stack>
            </Center>
          </Card> :

        <Stack gap="md">
            {historyQuery.data?.items.map((item) =>
          <Card key={item["id"]} withBorder p="md">
                <Group justify="space-between">
                  <div style={{ flex: 1 }}>
                    <Group mb="xs">
                      <Text fw={500}>{item.mangaTitle}</Text>
                      <Badge size="xs" color={getStatusColor(item["status"])}>
                        {item["status"]}
                      </Badge>
                    </Group>
                    <Text size="sm" c="dimmed">{item.chapterTitle}</Text>
                    <Group gap="xs" mt="xs">
                      <Text size="xs" c="dimmed">
                        {formatDate(item.downloadedAt)}
                      </Text>
                      <Text size="xs" c="dimmed">•</Text>
                      <Text size="xs" c="dimmed">{item.size}</Text>
                      <Text size="xs" c="dimmed">•</Text>
                      <Text size="xs" c="dimmed">{item["source"]}</Text>
                    </Group>
                  </div>
                  <Menu position="bottom-end">
                    <Menu.Target>
                      <ActionIcon variant="subtle">
                        <IconDotsVertical size={16} />
                      </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                      {item["status"] === 'FAILED' &&
                  <Menu.Item
                    leftSection={<IconRefresh size={14} />}
                    onClick={() => retryDownloadMutation.mutate(item["id"])}>

                          Retry Download
                        </Menu.Item>
                  }
                      {item["status"] === 'COMPLETED' &&
                  <Menu.Item
                    leftSection={<IconFileDownload size={14} />}
                    component="a"
                    href={`/api/download/${item["id"]}`}
                    download>

                          Download Again
                        </Menu.Item>
                  }
                      <Menu.Divider />
                      <Menu.Item
                    color="red"
                    leftSection={<IconTrash size={14} />}
                    onClick={() => deleteItemMutation.mutate(item["id"])}>

                        Delete Entry
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                </Group>
              </Card>
          )}
            
            {/* Pagination */}
            {historyQuery.data && historyQuery.data.totalPages > 1 &&
          <Group justify="center" mt="lg">
                <Pagination
              value={page}
              onChange={setPage}
              total={historyQuery.data.totalPages} />

              </Group>
          }
          </Stack>
        }
        
        {/* Export Button */}
        <Group justify="flex-end">
          <Button
            variant="light"
            leftSection={<IconFileDownload size={20} />}
            onClick={exportHistory}>

            Export History
          </Button>
        </Group>
      </Stack>
    </Container>);

}