/**
 * Wanted Summary Widget
 * 
 * A dashboard widget that displays a summary of wanted items
 * and download history using the custom hooks.
 * 
 * This component demonstrates how to use the wanted hooks
 * for building UI components.
 */

import React from 'react';

import {
  Card,
  Title,
  Text,
  SimpleGrid,
  ThemeIcon,
  Group,
  Badge,
  Stack,
  Progress,
  Button,
  Loader,
  Alert } from
'@mantine/core';
import {
  IconSearch,
  IconCheck,
  IconX,
  IconClock,
  IconDownload,
  IconAlertCircle,
  IconRefresh } from
'@tabler/icons-react';

import { useWantedItems, useDownloadHistory } from '@/hooks/useWanted';
/**
 * Wanted Summary Widget Component
 * 
 * Displays key metrics and actions for wanted functionality
 * 
 * @component
 * @example
 * ```tsx
 * <WantedSummaryWidget />
 * ```
 */
export function WantedSummaryWidget(): React.ReactElement {
  const wanted = useWantedItems();
  const history = useDownloadHistory();

  // Show loading state
  if (wanted.isLoadingWanted || history.isLoading) {
    return (
      <Card p="lg" withBorder>
        <Stack align="center" justify="center" h={200}>
          <Loader size="lg" />
          <Text size="sm" color="dimmed">Loading wanted data...</Text>
        </Stack>
      </Card>);

  }

  // Show error state
  if (wanted.wantedError ?? history.error) {
    return (
      <Card p="lg" withBorder>
        <Alert
          icon={<IconAlertCircle size={16} />}
          title="Error loading data"
          color="red">

          Unable to load wanted data. Please try again.
        </Alert>
      </Card>);

  }

  return (
    <Card p="lg" withBorder>
      <Stack gap="md">
        <Group justify="space-between">
          <Title order={3}>Wanted Summary</Title>
          <Group gap="xs">
            <Button
              size="xs"
              variant="light"
              leftSection={<IconRefresh size={14} />}
              onClick={() => {
                void wanted.refreshWanted();
                void history.refresh();
              }}>

              Refresh
            </Button>
            {wanted.stats.pending > 0 &&
            <Button
              size="xs"
              leftSection={<IconSearch size={14} />}
              onClick={() => { void wanted.searchAll(); }}
              loading={wanted.isSearching}>

                Search All ({wanted.stats.pending})
              </Button>
            }
          </Group>
        </Group>
        
        {/* Wanted Items Stats */}
        <div>
          <Text size="sm" fw={500} mb="xs">Wanted Items</Text>
          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="xs">
            <Card p="xs" withBorder>
              <Group gap="xs">
                <ThemeIcon size="sm" variant="light" color="blue">
                  <IconClock size={14} />
                </ThemeIcon>
                <div>
                  <Text size="xs" color="dimmed">Pending</Text>
                  <Text size="sm" fw={600}>{wanted.stats.pending}</Text>
                </div>
              </Group>
            </Card>
            
            <Card p="xs" withBorder>
              <Group gap="xs">
                <ThemeIcon size="sm" variant="light" color="yellow">
                  <IconSearch size={14} />
                </ThemeIcon>
                <div>
                  <Text size="xs" color="dimmed">Searching</Text>
                  <Text size="sm" fw={600}>{wanted.stats.searching}</Text>
                </div>
              </Group>
            </Card>
            
            <Card p="xs" withBorder>
              <Group gap="xs">
                <ThemeIcon size="sm" variant="light" color="green">
                  <IconCheck size={14} />
                </ThemeIcon>
                <div>
                  <Text size="xs" color="dimmed">Found</Text>
                  <Text size="sm" fw={600}>{wanted.stats.found}</Text>
                </div>
              </Group>
            </Card>
            
            <Card p="xs" withBorder>
              <Group gap="xs">
                <ThemeIcon size="sm" variant="light" color="red">
                  <IconX size={14} />
                </ThemeIcon>
                <div>
                  <Text size="xs" color="dimmed">Failed</Text>
                  <Text size="sm" fw={600}>{wanted.stats.failed}</Text>
                </div>
              </Group>
            </Card>
          </SimpleGrid>
        </div>
        
        {/* Download History Stats */}
        {history.stats &&
        <div>
            <Text size="sm" fw={500} mb="xs">Download History</Text>
            <Stack gap="xs">
              <Group justify="space-between">
                <Text size="xs" color="dimmed">Success Rate</Text>
                <Badge color={history.stats.successRate >= 80 ? 'green' : 'orange'}>
                  {history.stats.successRate.toFixed(1)}%
                </Badge>
              </Group>
              <Progress
              value={history.stats.successRate}
              color={history.stats.successRate >= 80 ? 'green' : 'orange'}
              size="sm" />

              <SimpleGrid cols={3} spacing="xs">
                <Text size="xs" ta="center">
                  <Text color="dimmed">Total</Text>
                  <Text fw={600}>{history.stats.totalDownloads}</Text>
                </Text>
                <Text size="xs" ta="center">
                  <Text color="dimmed">Success</Text>
                  <Text fw={600} color="green">{history.stats.successfulDownloads}</Text>
                </Text>
                <Text size="xs" ta="center">
                  <Text color="dimmed">Failed</Text>
                  <Text fw={600} color="red">{history.stats.failedDownloads}</Text>
                </Text>
              </SimpleGrid>
            </Stack>
          </div>
        }
        
        
        {/* Missing Items Alert */}
        {wanted.missingItems.length > 0 &&
        <Alert
          icon={<IconAlertCircle size={16} />}
          title="Missing Items Detected"
          color="yellow">

            {wanted.missingItems.length} manga have missing chapters. 
            <Button
            size="xs"
            variant="light"
            ml="xs"
            onClick={() => window.location.href = '/wanted/missing'}>

              View Missing
            </Button>
          </Alert>
        }
      </Stack>
    </Card>);

}

/**
 * Wanted Quick Actions Component
 * 
 * Provides quick access to common wanted actions
 * 
 * @component
 */
export function WantedQuickActions(): React.ReactElement {
  const _wanted = useWantedItems();

  return (
    <Group gap="xs">
      <Button
        size="xs"
        variant="light"
        leftSection={<IconSearch size={14} />}
        onClick={() => window.location.href = '/wanted/missing'}>

        Missing Items
      </Button>
      
      <Button
        size="xs"
        variant="light"
        leftSection={<IconDownload size={14} />}
        onClick={() => window.location.href = '/wanted/downloads'}>

        Downloads
      </Button>
      
      <Button
        size="xs"
        variant="light"
        leftSection={<IconClock size={14} />}
        onClick={() => window.location.href = '/wanted/downloads'}>

        History
      </Button>
    </Group>);

}