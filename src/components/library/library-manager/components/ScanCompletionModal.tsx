/**
 * Scan Completion Modal Component
 *
 * Automatically displays when a library scan completes.
 * Shows scan summary and allows user to review results before importing.
 *
 * @module components/library/library-manager/components/ScanCompletionModal
 */

import { memo, useMemo } from 'react';

import {
  Modal,
  ScrollArea,
  Stack,
  Group,
  Text,
  Badge,
  Button,
  SimpleGrid,
  Paper,
  ThemeIcon,
  Table
} from '@mantine/core';
import {
  IconCheck,
  IconFiles,
  IconPlus,
  IconPlayerSkipForward,
  IconX,
  IconSearch,
  IconChevronRight
} from '@tabler/icons-react';

import type { ScanItemSummary } from './ScanResultsPanel';

/**
 * Scan result data structure (matches what we store in jobs.result)
 */
export interface ScanResultData {
  totalFiles: number;
  processed: number;
  created: number;
  skipped: number;
  errors: number;
  items: ScanItemSummary[];
}

/**
 * Props for the ScanCompletionModal component
 */
interface ScanCompletionModalProps {
  /** Whether the modal is open */
  opened: boolean;
  /** Callback when modal is closed */
  onClose: () => void;
  /** Callback when user clicks "Review All" */
  onReviewClick: () => void;
  /** Callback when user selects an item to view details */
  onItemSelect: (item: ScanItemSummary) => void;
  /** Scan result data to display */
  scanResult: ScanResultData | null;
}

/**
 * Stat card component for displaying individual metrics
 */
interface StatCardProps {
  label: string;
  value: number;
  color?: string;
  icon: React.ReactNode;
}

function StatCard({ label, value, color = 'gray', icon }: StatCardProps): JSX.Element {
  return (
    <Paper withBorder p="sm" radius="md">
      <Group justify="space-between" mb="xs">
        <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
          {label}
        </Text>
        <ThemeIcon color={color} variant="light" size="sm">
          {icon}
        </ThemeIcon>
      </Group>
      <Text fw={700} size="lg">
        {value}
      </Text>
    </Paper>
  );
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
      return 'orange';
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
      return 'Exists';
    case 'error':
      return 'Error';
    case 'preview':
      return 'Ready';
    default:
      return status;
  }
}

/**
 * Modal that automatically displays when a library scan completes.
 *
 * Features:
 * - Summary stats (total, new, skipped, errors)
 * - Clickable table rows to open detail view
 * - "Review All" button for bulk review
 * - "Close" button to dismiss
 */
export const ScanCompletionModal = memo<ScanCompletionModalProps>(function ScanCompletionModal({
  opened,
  onClose,
  onReviewClick,
  onItemSelect,
  scanResult
}: ScanCompletionModalProps): JSX.Element | null {
  // Count importable items (not already existing)
  const importableCount = useMemo(() => {
    if (!scanResult?.items) return 0;
    return scanResult.items.filter(item => item.status !== 'exists').length;
  }, [scanResult?.items]);

  // All items (excluding already existing)
  const importableItems = useMemo(() => {
    if (!scanResult?.items) return [];
    return scanResult.items.filter(item => item.status !== 'exists');
  }, [scanResult?.items]);

  // Don't render if no scan result
  if (!scanResult) {
    return null;
  }

  const handleReviewClick = (): void => {
    onClose();
    onReviewClick();
  };

  const handleItemSelect = (item: ScanItemSummary): void => {
    onClose();
    onItemSelect(item);
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="900px"
      title={
        <Group gap="xs">
          <ThemeIcon color="green" variant="light" size="md">
            <IconCheck size={16} />
          </ThemeIcon>
          <Text fw={600}>Scan Complete</Text>
        </Group>
      }
    >
      <Stack gap="md">
        {/* Summary Stats */}
        <SimpleGrid cols={{ base: 2, sm: 4 }}>
          <StatCard
            label="Total Files"
            value={scanResult.totalFiles}
            color="gray"
            icon={<IconFiles size={14} />}
          />
          <StatCard
            label="New Items"
            value={scanResult.created}
            color="green"
            icon={<IconPlus size={14} />}
          />
          <StatCard
            label="Skipped"
            value={scanResult.skipped}
            color="blue"
            icon={<IconPlayerSkipForward size={14} />}
          />
          <StatCard
            label="Errors"
            value={scanResult.errors}
            color="red"
            icon={<IconX size={14} />}
          />
        </SimpleGrid>

        {/* Importable Items Summary */}
        {importableCount > 0 && (
          <Paper withBorder p="md" radius="md" bg="var(--mantine-color-blue-light)">
            <Group gap="xs">
              <IconSearch size={16} />
              <Text fw={500}>
                {importableCount} item{importableCount !== 1 ? 's' : ''} ready for import
              </Text>
            </Group>
            <Text size="sm" c="dimmed" mt={4}>
              Click on an item to search for metadata and verify file mappings before importing.
            </Text>
          </Paper>
        )}

        {/* Items Table */}
        {importableItems.length > 0 && (
          <ScrollArea h={300} type="auto">
            <Table striped highlightOnHover style={{ minWidth: '650px' }}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ width: '220px' }}>Title</Table.Th>
                  <Table.Th style={{ width: '150px' }}>Match</Table.Th>
                  <Table.Th style={{ width: '80px' }}>Chapters</Table.Th>
                  <Table.Th style={{ width: '80px' }}>Status</Table.Th>
                  <Table.Th style={{ width: '40px' }}></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {importableItems.map((item) => (
                  <Table.Tr
                    key={item.path}
                    style={{ cursor: 'pointer' }}
                    onClick={() => handleItemSelect(item)}
                  >
                    <Table.Td>
                      <Text fw={500} size="sm" truncate style={{ maxWidth: '200px' }}>
                        {item.title}
                      </Text>
                      <Text size="xs" c="dimmed" truncate style={{ maxWidth: '200px' }}>
                        {item.path.split('/').slice(-2).join('/')}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      {item.matchedTitle ? (
                        <Stack gap={2}>
                          <Text size="sm" truncate style={{ maxWidth: '130px' }}>
                            {item.matchedTitle}
                          </Text>
                          <Group gap={4}>
                            {item.provider && (
                              <Badge size="xs" variant="light" color="violet">
                                {item.provider}
                              </Badge>
                            )}
                            {item.confidence !== undefined && item.confidence !== null && (
                              <Badge size="xs" variant="outline" color="gray">
                                {Math.round(item.confidence * 100)}%
                              </Badge>
                            )}
                          </Group>
                        </Stack>
                      ) : (
                        <Text size="sm" c="dimmed">No match</Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="light" size="sm">
                        {item.chapters} ch
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={getStatusColor(item.status)} size="sm">
                        {getStatusLabel(item.status)}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <IconChevronRight size={16} color="var(--mantine-color-dimmed)" />
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        )}

        {/* No Importable Items */}
        {importableCount === 0 && (
          <Paper withBorder p="md" radius="md">
            <Text ta="center" c="dimmed">
              No new items found. All manga in this directory already exist in the library.
            </Text>
          </Paper>
        )}

        {/* Action Buttons */}
        <Group justify="flex-end" mt="md">
          <Button variant="subtle" onClick={onClose}>
            Close
          </Button>
          {importableCount > 0 && (
            <Button
              leftSection={<IconSearch size={16} />}
              onClick={handleReviewClick}
            >
              Review All
            </Button>
          )}
        </Group>
      </Stack>
    </Modal>
  );
});

ScanCompletionModal.displayName = 'ScanCompletionModal';
