/**
 * Scan Items Modal Component
 *
 * Displays individual scan items with filtering by status.
 * Shows item details including title, path, status, and errors.
 *
 * @module components/library/library-manager/components/ScanItemsModal
 */

import { useState, useMemo, memo } from 'react';

import {
  Modal,
  Tabs,
  ScrollArea,
  Stack,
  Card,
  Group,
  Text,
  Badge,
  Tooltip,
  ActionIcon
} from '@mantine/core';
import { IconExternalLink, IconAlertTriangle } from '@tabler/icons-react';

import type { ScanItemSummary } from './ScanResultsPanel';

/**
 * Props for the ScanItemsModal component
 */
interface ScanItemsModalProps {
  /** Whether the modal is open */
  opened: boolean;
  /** Callback when modal is closed */
  onClose: () => void;
  /** Array of scan items to display */
  items: ScanItemSummary[];
}

/**
 * Get badge color for item status
 */
function getStatusColor(status: string): string {
  switch (status) {
    case 'created':
      return 'green';
    case 'enriched':
      return 'teal';
    case 'exists':
      return 'blue';
    case 'error':
      return 'red';
    case 'preview':
      return 'gray';
    default:
      return 'gray';
  }
}

/**
 * Get display label for status
 */
function getStatusLabel(status: string): string {
  switch (status) {
    case 'created':
      return 'Created';
    case 'enriched':
      return 'Enriched';
    case 'exists':
      return 'Skipped';
    case 'error':
      return 'Error';
    case 'preview':
      return 'Preview';
    default:
      return status;
  }
}

/**
 * Modal showing individual scan items with filtering
 *
 * Features:
 * - Tab-based filtering by status
 * - Shows item count per status
 * - Displays item title, path, status badge
 * - Shows chapter count and error messages
 */
export const ScanItemsModal = memo<ScanItemsModalProps>(function ScanItemsModal({
  opened,
  onClose,
  items
}: ScanItemsModalProps): JSX.Element {
  const [filterStatus, setFilterStatus] = useState<string | null>(null);

  // Count items by status
  const counts = useMemo(() => ({
    all: items.length,
    created: items.filter(i => i.status === 'created').length,
    enriched: items.filter(i => i.status === 'enriched').length,
    exists: items.filter(i => i.status === 'exists').length,
    error: items.filter(i => i.status === 'error').length
  }), [items]);

  // Filter items based on selected status
  const filteredItems = useMemo(() => {
    if (!filterStatus || filterStatus === 'all') {
      return items;
    }
    return items.filter(item => item.status === filterStatus);
  }, [items, filterStatus]);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="xl"
      title="Scan Results"
    >
      {/* Filter Tabs */}
      <Tabs
        value={filterStatus ?? 'all'}
        onChange={(value) => setFilterStatus(value)}
      >
        <Tabs.List>
          <Tabs.Tab value="all">
            All ({counts.all})
          </Tabs.Tab>
          <Tabs.Tab value="created" color="green">
            Created ({counts.created})
          </Tabs.Tab>
          <Tabs.Tab value="enriched" color="teal">
            Enriched ({counts.enriched})
          </Tabs.Tab>
          <Tabs.Tab value="exists" color="blue">
            Skipped ({counts.exists})
          </Tabs.Tab>
          <Tabs.Tab value="error" color="red">
            Errors ({counts.error})
          </Tabs.Tab>
        </Tabs.List>
      </Tabs>

      {/* Items List */}
      <ScrollArea h={400} mt="md">
        <Stack gap="xs">
          {filteredItems.length === 0 ? (
            <Text c="dimmed" ta="center" py="xl">
              No items to display
            </Text>
          ) : (
            filteredItems.map((item, index) => (
              <Card key={index} withBorder p="sm">
                <Group justify="space-between" wrap="nowrap">
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <Group gap="xs" wrap="nowrap">
                      <Text fw={500} truncate style={{ flex: 1 }}>
                        {item.title}
                      </Text>
                      {item.mangaId && (
                        <Tooltip label="View manga page">
                          <ActionIcon
                            variant="subtle"
                            size="sm"
                            component="a"
                            href={`/manga/${item.mangaId}`}
                          >
                            <IconExternalLink size={14} />
                          </ActionIcon>
                        </Tooltip>
                      )}
                    </Group>
                    <Text size="xs" c="dimmed" truncate>
                      {item.path}
                    </Text>
                    {/* Additional metadata row */}
                    <Group gap="xs" mt={4}>
                      {item.provider && (
                        <Badge variant="dot" size="xs" color="violet">
                          {item.provider}
                        </Badge>
                      )}
                      {item.confidence !== undefined && item.confidence !== null && item.confidence > 0 && (
                        <Badge variant="outline" size="xs" color="gray">
                          {Math.round(item.confidence * 100)}% match
                        </Badge>
                      )}
                      {item.year && (
                        <Text size="xs" c="dimmed">
                          {item.year}
                        </Text>
                      )}
                      {item.group && (
                        <Text size="xs" c="dimmed">
                          [{item.group}]
                        </Text>
                      )}
                      {item.language && (
                        <Badge variant="light" size="xs" color="gray">
                          {item.language}
                        </Badge>
                      )}
                    </Group>
                    {/* Show matched title if different from parsed title */}
                    {item.matchedTitle && item.matchedTitle !== item.title && (
                      <Text size="xs" c="teal" mt={2}>
                        Matched: {item.matchedTitle}
                      </Text>
                    )}
                  </div>
                  <Group gap="xs" wrap="nowrap">
                    {item.chapters > 0 && (
                      <Badge variant="light" size="sm">
                        {item.chapters} ch
                      </Badge>
                    )}
                    {item.requiresUserSelection && (
                      <Tooltip label={`${item.matchCount ?? 0} matches need review`}>
                        <Badge variant="light" color="yellow" size="sm" leftSection={<IconAlertTriangle size={12} />}>
                          Review
                        </Badge>
                      </Tooltip>
                    )}
                    {item.enriched && !item.requiresUserSelection && (
                      <Badge variant="light" color="teal" size="sm">
                        Matched
                      </Badge>
                    )}
                    <Badge color={getStatusColor(item.status)} size="sm">
                      {getStatusLabel(item.status)}
                    </Badge>
                  </Group>
                </Group>
                {item.error && (
                  <Text size="sm" c="red" mt="xs">
                    {item.error}
                  </Text>
                )}
              </Card>
            ))
          )}
        </Stack>
      </ScrollArea>
    </Modal>
  );
});

ScanItemsModal.displayName = 'ScanItemsModal';
