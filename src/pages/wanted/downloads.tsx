/**
 * Latest Downloads Page
 * 
 * Displays recently downloaded manga chapters with their status
 * and download information. Shows successful downloads, failures,
 * and in-progress downloads.
 * 
 * Features:
 * - Real-time download status
 * - Download statistics
 * - Filter by status and date
 * - Download speed and size information
 * 
 * @module pages/wanted/downloads
 */

import React, { useState } from "react";
import type { ReactElement } from 'react';

import {
  Card,
  Text,
  Badge,
  Group,
  Stack,
  Select,
  Loader,
  Alert,
  Paper,
  Progress,
  SimpleGrid,
  ThemeIcon } from
'@mantine/core';
import { DownloadHistoryStatus } from '@prisma/client';
import {
  IconDownload,
  IconAlertCircle,
  IconCheck,
  IconX,
  IconClock,
  IconFileDownload } from
'@tabler/icons-react';

import { EmptyState } from '@/components/emptyState';
import { ResponsiveMainLayout } from '@/components/layouts/ResponsiveMainLayout';
import WantedLayout from '@/components/layouts/WantedLayout';
import { mapToMangaStatus } from '@/utils/status-mapper';
import { trpc } from '@/utils/trpc-client/index';


/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Format download speed
 */
function formatSpeed(bytesPerSecond: number): string {
  return formatBytes(bytesPerSecond) + '/s';
}

/**
 * Get status badge color
 */
function getStatusColor(status: DownloadHistoryStatus): string {
  return mapToMangaStatus(status);
}

/**
 * Get status icon
 */
function getStatusIcon(status: DownloadHistoryStatus): React.ReactElement {
  switch (status) {
    case DownloadHistoryStatus.COMPLETED:
      return <IconCheck size={16} />;
    case DownloadHistoryStatus.FAILED:
      return <IconX size={16} />;
    case DownloadHistoryStatus.CANCELLED:
      return <IconClock size={16} />;
    default:
      return <IconDownload size={16} />;
  }
}

/**
 * Latest Downloads Page Component
 * 
 * Fetches and displays recent download history with filtering
 * and statistics.
 * 
 * @component
 * @returns {JSX.Element} Downloads page with history and stats
 */
export default function LatestDownloadsPage(): React.ReactElement {
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [dateRange, _setDateRange] = useState<[Date | null, Date | null]>([null, null]);

  // Build query filters
  const filters = {
    status: statusFilter ? [statusFilter as DownloadHistoryStatus] : undefined,
    dateRange: dateRange[0] && dateRange[1] ? {
      start: dateRange[0],
      end: dateRange[1]
    } : undefined,
    page: 1,
    pageSize: 50
  };

  // Fetch download history
  const {
    data: historyData,
    error,
    isLoading
  } = trpc.wanted.getHistory.useQuery(filters);

  // Show loading state
  if (isLoading) {
    return (
      <WantedLayout title="Latest Downloads">
        <Stack align="center" mt="xl">
          <Loader size="lg" />
          <Text color="dimmed">Loading download history...</Text>
        </Stack>
      </WantedLayout>);

  }

  // Show error state
  if (error) {
    return (
      <WantedLayout title="Latest Downloads">
        <Alert
          icon={<IconAlertCircle size={16} />}
          title="Error loading downloads"
          color="red">

          {(error instanceof Error ? error.message : String(error)) || 'An unexpected error occurred'}
        </Alert>
      </WantedLayout>);

  }

  // Show empty state if no downloads
  if (!historyData?.entries.length) {
    return (
      <WantedLayout title="Latest Downloads">
        <EmptyState
          title="No Downloads Yet"
          description="Your download history will appear here"
          icon={<IconDownload size={48} strokeWidth={1.5} />} />

      </WantedLayout>);

  }

  const stats = historyData.stats;

  return (
    <WantedLayout title="Latest Downloads">
      <Stack gap="md">
        {/* Statistics Cards */}
        <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
          <Paper p="md" withBorder>
            <Group gap="xs">
              <ThemeIcon color="blue" size="lg" radius="md">
                <IconDownload size={20} />
              </ThemeIcon>
              <div>
                <Text size="xs" color="dimmed">Total Downloads</Text>
                <Text size="lg" fw={600}>{stats?.totalDownloads ?? 0}</Text>
              </div>
            </Group>
          </Paper>
          
          <Paper p="md" withBorder>
            <Group gap="xs">
              <ThemeIcon color="green" size="lg" radius="md">
                <IconCheck size={20} />
              </ThemeIcon>
              <div>
                <Text size="xs" color="dimmed">Successful</Text>
                <Text size="lg" fw={600}>{stats?.successfulDownloads ?? 0}</Text>
              </div>
            </Group>
          </Paper>
          
          <Paper p="md" withBorder>
            <Group gap="xs">
              <ThemeIcon color="red" size="lg" radius="md">
                <IconX size={20} />
              </ThemeIcon>
              <div>
                <Text size="xs" color="dimmed">Failed</Text>
                <Text size="lg" fw={600}>{stats?.failedDownloads ?? 0}</Text>
              </div>
            </Group>
          </Paper>
          
          <Paper p="md" withBorder>
            <Group gap="xs">
              <ThemeIcon color="violet" size="lg" radius="md">
                <IconFileDownload size={20} />
              </ThemeIcon>
              <div>
                <Text size="xs" color="dimmed">Total Size</Text>
                <Text size="lg" fw={600}>N/A</Text>
              </div>
            </Group>
          </Paper>
        </SimpleGrid>
        
        {/* Filters */}
        <Paper p="md" withBorder>
          <Group>
            <Select
              placeholder="Filter by status"
              data={[
              { value: '', label: 'All Statuses' },
              { value: DownloadHistoryStatus.COMPLETED, label: 'Completed' },
              { value: DownloadHistoryStatus.FAILED, label: 'Failed' },
              { value: DownloadHistoryStatus.CANCELLED, label: 'Cancelled' },
              { value: DownloadHistoryStatus.PARTIAL, label: 'Partial' }]
              }
              value={statusFilter}
              onChange={setStatusFilter}
              clearable
              style={{ width: 200 }} />

            
            {/* Date filtering temporarily disabled - @mantine/dates not installed
              <DatePickerInput
               type="range"
               placeholder="Select date range"
               value={dateRange}
               onChange={setDateRange}
               clearable
               style={{ width: 300 }}
              />
              */}
          </Group>
        </Paper>
        
        {/* Download History List */}
        <Stack gap="sm">
          {historyData.entries.map((entry) =>
          <Card key={entry["id"]} p="md" withBorder>
              <Group justify="space-between" align="flex-start">
                <Stack gap="xs" style={{ flex: 1 }}>
                  <Group gap="xs">
                    <Text fw={500}>
                      {entry["metadata"]?.mangaTitle || 'Unknown Manga'}
                    </Text>
                    {entry["metadata"]?.chapterNumber &&
                  <Badge variant="light">
                        Chapter {entry["metadata"].chapterNumber}
                      </Badge>
                  }
                  </Group>
                  
                  <Group gap="md">
                    <Badge
                    leftSection={getStatusIcon(entry["status"])}
                    color={getStatusColor(entry["status"])}
                    variant="light">

                      {entry["status"]}
                    </Badge>
                    
                    <Text size="sm" color="dimmed">
                      Source: {entry["source"]}
                    </Text>
                    
                    <Text size="sm" color="dimmed">
                      Client: {entry.downloadClient}
                    </Text>
                    
                    {entry.downloadSize &&
                  <Text size="sm" color="dimmed">
                        Size: {formatBytes(entry.downloadSize)}
                      </Text>
                  }
                    
                    {entry.downloadSpeed &&
                  <Text size="sm" color="dimmed">
                        Speed: {formatSpeed(entry.downloadSpeed)}
                      </Text>
                  }
                  </Group>
                  
                  <Group gap="xs">
                    <Text size="xs" color="dimmed">
                      Started: {entry.startTime ? new Date(entry.startTime).toLocaleString() : 'Unknown'}
                    </Text>
                    {entry.endTime &&
                  <Text size="xs" color="dimmed">
                        • Completed: {new Date(entry.endTime).toLocaleString()}
                      </Text>
                  }
                  </Group>
                  
                  {entry.errorMessage &&
                <Alert
                  icon={<IconAlertCircle size={16} />}
                  color="red"
                  p="xs">

                      {entry.errorMessage}
                    </Alert>
                }
                </Stack>
              </Group>
            </Card>
          )}
        </Stack>
        
        {/* Success rate indicator */}
        {stats && stats.totalDownloads > 0 &&
        <Paper p="md" withBorder>
            <Text size="sm" mb="xs">
              Success Rate: {Math.round(stats.successfulDownloads / stats.totalDownloads * 100)}%
            </Text>
            <Progress
            value={stats.successfulDownloads / stats.totalDownloads * 100}
            color="green"
            size="lg" />

          </Paper>
        }
      </Stack>
    </WantedLayout>);

}

// Use MainLayout for this page to get the full navigation
LatestDownloadsPage.getLayout = function getLayout(page: ReactElement): React.ReactElement {
  return <ResponsiveMainLayout>{page}</ResponsiveMainLayout>;
};