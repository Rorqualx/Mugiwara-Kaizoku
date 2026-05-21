/**
 * Release Blocklist Page
 *
 * Manages blocked file releases to prevent re-downloading problematic files.
 * The system automatically finds alternatives when releases are blocked.
 *
 * Features:
 * - View blocked releases with reasons
 * - Search and filter blocklist entries
 * - View quality metrics and statistics
 * - Manage block patterns
 *
 * @module pages/settings/release-blocklist
 */

import React, { useState } from "react";
import type { ReactElement } from 'react';

import {
  Card,
  Text,
  Badge,
  Group,
  Stack,
  TextInput,
  Select,
  Loader,
  Alert,
  Title,
  Paper,
  Tooltip,
  Table,
  ActionIcon,
  Button,
  SimpleGrid,
  ThemeIcon,
  Tabs} from
'@mantine/core';
import { showNotification } from '@mantine/notifications';
import { ReleaseBlocklistReason } from '@prisma/client';
import {
  IconAlertCircle,
  IconSearch,
  IconTrash,
  IconCheck,
  IconX,
  IconDatabase,
  IconRefresh,
  IconInfoCircle,
  IconFilter,
  IconChartBar,
  IconSettings } from
'@tabler/icons-react';
import { formatDistanceToNow } from 'date-fns';

import { EmptyState } from '@/components/emptyState';
import { ResponsiveMainLayout } from '@/components/layouts/ResponsiveMainLayout';
import SettingsLayout from '@/components/layouts/SettingsLayout';
import { trpc } from '@/utils/trpc-client/index';


/**
 * Get reason badge color
 */
function getReasonColor(reason: ReleaseBlocklistReason): string {
  switch (reason) {
    case ReleaseBlocklistReason.QUALITY_POOR:
      return 'red';
    case ReleaseBlocklistReason.WRONG_LANGUAGE:
      return 'blue';
    case ReleaseBlocklistReason.INCOMPLETE:
      return 'orange';
    case ReleaseBlocklistReason.WATERMARKED:
      return 'yellow';
    case ReleaseBlocklistReason.DUPLICATE:
      return 'gray';
    case ReleaseBlocklistReason.CORRUPTED:
      return 'red';
    case ReleaseBlocklistReason.WRONG_CONTENT:
      return 'pink';
    case ReleaseBlocklistReason.RELEASE_GROUP:
      return 'violet';
    case ReleaseBlocklistReason.USER_PREFERENCE:
      return 'cyan';
    case ReleaseBlocklistReason.AUTO_QUALITY:
      return 'teal';
    case ReleaseBlocklistReason.DMCA:
      return 'red';
    default:
      return 'gray';
  }
}

/**
 * Get human-readable reason label
 */
function getReasonLabel(reason: ReleaseBlocklistReason): string {
  switch (reason) {
    case ReleaseBlocklistReason.QUALITY_POOR:
      return 'Poor Quality';
    case ReleaseBlocklistReason.WRONG_LANGUAGE:
      return 'Wrong Language';
    case ReleaseBlocklistReason.INCOMPLETE:
      return 'Incomplete';
    case ReleaseBlocklistReason.WATERMARKED:
      return 'Watermarked';
    case ReleaseBlocklistReason.DUPLICATE:
      return 'Duplicate';
    case ReleaseBlocklistReason.CORRUPTED:
      return 'Corrupted';
    case ReleaseBlocklistReason.WRONG_CONTENT:
      return 'Wrong Content';
    case ReleaseBlocklistReason.RELEASE_GROUP:
      return 'Release Group';
    case ReleaseBlocklistReason.USER_PREFERENCE:
      return 'User Preference';
    case ReleaseBlocklistReason.AUTO_QUALITY:
      return 'Auto-Blocked';
    case ReleaseBlocklistReason.DMCA:
      return 'DMCA/Legal';
    default:
      return 'Other';
  }
}

/**
 * Format file size
 */
function formatFileSize(bytes?: bigint | null): string {
  if (!bytes) return 'Unknown';
  const size = Number(bytes);
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * Release Blocklist Page Component
 * 
 * Manages blocked releases with automatic alternative finding.
 * 
 * @component
 * @returns {JSX.Element} Release blocklist management page
 */
export default function ReleaseBlocklistPage(): React.ReactElement {
  const [activeTab, setActiveTab] = useState<string | null>('BLOCKED');
  const [searchTerm, setSearchTerm] = useState('');
  const [reasonFilter, setReasonFilter] = useState<string>('');

  // Fetch blocklist entries
  const {
    data: blocklistData,
    error,
    refetch,
    isLoading
  } = trpc.releaseBlocklist.search.useQuery({
    searchTerm: searchTerm,
    reason: reasonFilter ? [reasonFilter as ReleaseBlocklistReason] : undefined,
    includeInactive: false,
    limit: 100
  });

  // Fetch statistics
  const {
    data: stats,
    isLoading: statsLoading
  } = trpc.releaseBlocklist.getStatistics.useQuery();

  // Mutations
  const removeFromBlocklistMutation = trpc.releaseBlocklist.remove.useMutation({
    onSuccess: () => {
      showNotification({
        title: 'Success',
        message: 'Removed from blocklist',
        color: 'green'
      });
      void refetch();
    },
    onError: (error: unknown) => {
      showNotification({
        title: 'Error',
        message: (error instanceof Error ? error.message : String(error)) ?? 'Failed to remove from blocklist',
        color: 'red'
      });
    }
  });

  // Show loading state
  if (isLoading || statsLoading) {
    return (
      <SettingsLayout>
        <Stack align="center" mt="xl">
          <Loader size="lg" />
          <Text color="dimmed">Loading release blocklist...</Text>
        </Stack>
      </SettingsLayout>);

  }

  // Show error state
  if (error) {
    return (
      <SettingsLayout>
        <Alert
          icon={<IconAlertCircle size={16} />}
          title="Error loading release blocklist"
          color="red">

          {(error instanceof Error ? error.message : String(error)) ?? 'An unexpected error occurred'}
        </Alert>
      </SettingsLayout>);

  }

  return (
    <SettingsLayout>
      <Stack gap="md">
        <div>
          <Title order={2}>Release Blocklist</Title>
          <Text size="sm" color="dimmed" mt="xs">
            Automatically blocks problematic file releases and finds better alternatives
          </Text>
        </div>
        
        {/* Info Alert */}
        <Alert
          icon={<IconInfoCircle size={20} />}
          title="How it works"
          color="blue"
          variant="light">

          <Text size="sm">
            When a release is blocked, the system automatically searches for alternative releases
            of the same content. Releases can be blocked manually or automatically based on quality metrics.
          </Text>
        </Alert>
        
        {/* Statistics */}
        {stats &&
        <SimpleGrid cols={4} spacing="md">
            <Card p="md" withBorder>
              <Group justify="space-between">
                <div>
                  <Text size="xs" color="dimmed" tt="uppercase" fw={600}>
                    Total Blocked
                  </Text>
                  <Text size="xl" fw={700}>
                    {stats.totalBlocked}
                  </Text>
                </div>
                <ThemeIcon size="xl" variant="light" color="red">
                  <IconX size={24} />
                </ThemeIcon>
              </Group>
            </Card>
            
            <Card p="md" withBorder>
              <Group justify="space-between">
                <div>
                  <Text size="xs" color="dimmed" tt="uppercase" fw={600}>
                    Active Blocks
                  </Text>
                  <Text size="xl" fw={700}>
                    {stats.totalBlocked}
                  </Text>
                </div>
                <ThemeIcon size="xl" variant="light" color="green">
                  <IconCheck size={24} />
                </ThemeIcon>
              </Group>
            </Card>
            
            <Card p="md" withBorder>
              <Group justify="space-between">
                <div>
                  <Text size="xs" color="dimmed" tt="uppercase" fw={600}>
                    Auto-Blocked
                  </Text>
                  <Text size="xl" fw={700}>
                    {stats.autoBlocked}
                  </Text>
                </div>
                <ThemeIcon size="xl" variant="light" color="teal">
                  <IconSettings size={24} />
                </ThemeIcon>
              </Group>
            </Card>
            
            <Card p="md" withBorder>
              <Group justify="space-between">
                <div>
                  <Text size="xs" color="dimmed" tt="uppercase" fw={600}>
                    Success Rate
                  </Text>
                  <Text size="xl" fw={700}>
                    N/A
                  </Text>
                </div>
                <ThemeIcon size="xl" variant="light" color="blue">
                  <IconChartBar size={24} />
                </ThemeIcon>
              </Group>
            </Card>
          </SimpleGrid>
        }
        
        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Tab value="blocked" leftSection={<IconDatabase size={16} />}>
              Blocked Releases
            </Tabs.Tab>
            <Tabs.Tab value="patterns" leftSection={<IconFilter size={16} />}>
              Block Patterns
            </Tabs.Tab>
            <Tabs.Tab value="groups" leftSection={<IconSettings size={16} />}>
              Release Groups
            </Tabs.Tab>
          </Tabs.List>
          
          <Tabs.Panel value="blocked" pt="md">
            <Stack gap="md">
              {/* Search and filters */}
              <Paper p="md" withBorder>
                <Group>
                  <TextInput
                    placeholder="Search blocked releases..."
                    leftSection={<IconSearch size={16} />}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.currentTarget.value)}
                    style={{ flex: 1 }} />

                  
                  <Select
                    placeholder="Filter by reason"
                    data={[
                    { value: '', label: 'All Reasons' },
                    ...Object.values(ReleaseBlocklistReason).map((reason) => ({
                      value: reason as string,
                      label: getReasonLabel(reason)
                    }))]
                    }
                    value={reasonFilter}
                    onChange={(value) => setReasonFilter(value ?? '')}
                    clearable
                    style={{ width: 200 }} />

                  
                  <Button
                    leftSection={<IconRefresh size={16} />}
                    onClick={() => { void refetch(); }}
                    variant="light">

                    Refresh
                  </Button>
                </Group>
              </Paper>
              
              {/* Blocked releases table */}
              {blocklistData?.entries.length === 0 ?
              <EmptyState
                title="No blocked releases"
                description={searchTerm || reasonFilter ?
                "No blocked releases match your filters" :
                "Releases will be automatically blocked based on quality issues"
                }
                icon={<IconDatabase size={48} strokeWidth={1.5} />} /> :

              <Paper withBorder>
                  <Table striped highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Release Title</Table.Th>
                        <Table.Th>Reason</Table.Th>
                        <Table.Th>Details</Table.Th>
                        <Table.Th>Size</Table.Th>
                        <Table.Th>Blocked</Table.Th>
                        <Table.Th>Actions</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {blocklistData?.entries.map((entry: Record<string, unknown>) => {
                        const id = entry['id'];
                        const releaseTitle = entry['releaseTitle'];
                        const chapterNumber = entry['chapterNumber'];
                        const reason = entry['reason'] as ReleaseBlocklistReason;
                        const reasonDetails = entry['reasonDetails'];
                        const fileSize = entry['fileSize'];
                        const dateAdded = entry['dateAdded'];
                        const autoBlocked = entry['autoBlocked'];
                        const addedBy = entry['addedBy'];

                        // Type guard for id
                        if (typeof id !== 'string') return null;

                        return (
                          <Table.Tr key={id}>
                            <Table.Td>
                              <Stack gap={4}>
                                <Text size="sm" fw={500} lineClamp={1}>
                                  {typeof releaseTitle === 'string' ? releaseTitle : ''}
                                </Text>
                                {typeof chapterNumber === 'number' && (
                                  <Badge size="xs" variant="light">
                                    Chapter {chapterNumber}
                                  </Badge>
                                )}
                              </Stack>
                            </Table.Td>
                            <Table.Td>
                              <Badge
                                color={getReasonColor(reason)}
                                variant="light">
                                {getReasonLabel(reason)}
                              </Badge>
                            </Table.Td>
                            <Table.Td>
                              <Tooltip label={typeof reasonDetails === 'string' ? reasonDetails : 'No details'}>
                                <Text size="sm" color="dimmed" lineClamp={1}>
                                  {typeof reasonDetails === 'string' ? reasonDetails : '-'}
                                </Text>
                              </Tooltip>
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm">
                                {formatFileSize(typeof fileSize === 'bigint' ? fileSize : null)}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Stack gap={2}>
                                <Text size="xs" color="dimmed">
                                  {(typeof dateAdded === 'string' || dateAdded instanceof Date)
                                    ? formatDistanceToNow(new Date(dateAdded as string | Date), { addSuffix: true })
                                    : '-'}
                                </Text>
                                <Text size="xs" color="dimmed">
                                  by {autoBlocked ? 'System' : (typeof addedBy === 'string' ? addedBy : 'Unknown')}
                                </Text>
                              </Stack>
                            </Table.Td>
                            <Table.Td>
                              <Tooltip label="Remove from blocklist">
                                <ActionIcon
                                  color="red"
                                  variant="subtle"
                                  onClick={() => { void removeFromBlocklistMutation.mutateAsync({ id }); }}
                                  loading={removeFromBlocklistMutation.isPending}>
                                  <IconTrash size={16} />
                                </ActionIcon>
                              </Tooltip>
                            </Table.Td>
                          </Table.Tr>
                        );
                      })}
                    </Table.Tbody>
                  </Table>
                </Paper>
              }
            </Stack>
          </Tabs.Panel>
          
          <Tabs.Panel value="patterns" pt="md">
            <Stack gap="md">
              <Alert icon={<IconInfoCircle size={16} />} color="blue">
                <Text size="sm">
                  Block patterns use regular expressions to automatically block releases matching specific criteria.
                  For example: <code>.*\[BadGroup\].*</code> blocks all releases from "BadGroup".
                </Text>
              </Alert>
              
              {/* Pattern list would go here */}
              <EmptyState
                title="Pattern management coming soon"
                description="You'll be able to manage block patterns here"
                icon={<IconFilter size={48} strokeWidth={1.5} />} />

            </Stack>
          </Tabs.Panel>
          
          <Tabs.Panel value="groups" pt="md">
            <Stack gap="md">
              <Alert icon={<IconInfoCircle size={16} />} color="blue">
                <Text size="sm">
                  Release groups are automatically detected from release names.
                  You can block entire groups to prevent all their releases from being downloaded.
                </Text>
              </Alert>
              
              {/* Release groups stats */}
              {stats?.reasonCounts && stats.reasonCounts[ReleaseBlocklistReason.RELEASE_GROUP] > 0 &&
              <Card p="md" withBorder>
                  <Text size="sm" fw={500} mb="xs">
                    Blocked Release Groups
                  </Text>
                  <Text size="xl" fw={700}>
                    {stats.reasonCounts[ReleaseBlocklistReason.RELEASE_GROUP]}
                  </Text>
                </Card>
              }
              
              {/* Group list would go here */}
              <EmptyState
                title="Release group management coming soon"
                description="You'll be able to manage blocked release groups here"
                icon={<IconSettings size={48} strokeWidth={1.5} />} />

            </Stack>
          </Tabs.Panel>
        </Tabs>
      </Stack>
    </SettingsLayout>);

}

// Use MainLayout for this page to get the full navigation
ReleaseBlocklistPage.getLayout = function getLayout(page: ReactElement): React.ReactElement {
  return <ResponsiveMainLayout>{page}</ResponsiveMainLayout>;
};