/**
 * Scan Review Table Component
 *
 * Displays scanned manga items in a bulk-editable table format.
 * Allows users to select items and trigger import via Import Wizard or Quick Add.
 *
 * @module components/library/library-manager/components/ScanReviewTable
 */

import { useMemo, useCallback, memo } from 'react';

import {
  Table,
  Checkbox,
  Group,
  Text,
  Badge,
  Button,
  ActionIcon,
  Tooltip,
  Paper,
  Stack,
  Alert,
  ScrollArea,
  Menu
} from '@mantine/core';
import {
  IconSearch,
  IconRocket,
  IconX,
  IconCheck,
  IconAlertCircle,
  IconDotsVertical,
  IconPlayerPlay,
  IconTrash,
  IconLoader2
} from '@tabler/icons-react';

/**
 * Status for each review item
 */
export type ScanReviewStatus = 'pending' | 'importing' | 'done' | 'error' | 'skipped';

/**
 * A single item in the scan review table
 */
export interface ScanReviewItem {
  /** Unique identifier for this item */
  id: string;
  /** Full path to the scanned manga directory */
  path: string;
  /** Title parsed from the directory/file name */
  parsedTitle: string;
  /** Number of chapters/files found */
  chapters: number;
  /** Total file size in bytes */
  fileSize: number;
  /** Whether this item is selected for bulk operations */
  selected: boolean;
  /** Current import status */
  status: ScanReviewStatus;
  /** Error message if status is 'error' */
  errorMessage?: string;
  /** Manga ID after successful import */
  importedMangaId?: number;
  /** AniList ID from metadata selection (for pre-filling wizard) */
  matchedAnilistId?: number;
}

/**
 * Props for the ScanReviewTable component
 */
interface ScanReviewTableProps {
  /** Items to display in the table */
  items: ScanReviewItem[];
  /** Selected library ID for import */
  libraryId: number;
  /** Callback when an item's selection changes */
  onSelectionChange: (itemId: string, selected: boolean) => void;
  /** Callback to select/deselect all items */
  onSelectAll: (selected: boolean) => void;
  /** Callback when "Import via Wizard" is clicked for an item */
  onImportWithWizard: (item: ScanReviewItem) => void;
  /** Callback when "Quick Add" is clicked for an item */
  onQuickAdd: (item: ScanReviewItem) => void;
  /** Callback when "Skip" is clicked for an item */
  onSkip: (itemId: string) => void;
  /** Callback when "Delete" is clicked for an item (removes from list) */
  onDelete: (itemId: string) => void;
  /** Callback for bulk import with wizard */
  onBulkImportWithWizard: () => void;
  /** Callback for bulk quick add */
  onBulkQuickAdd: () => void;
  /** Callback to clear all items */
  onClearAll: () => void;
  /** Whether any import operation is in progress */
  isImporting: boolean;
}

/**
 * Format file size for display
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

/**
 * Get badge color for status
 */
function getStatusColor(status: ScanReviewStatus): string {
  switch (status) {
    case 'pending':
      return 'gray';
    case 'importing':
      return 'blue';
    case 'done':
      return 'green';
    case 'error':
      return 'red';
    case 'skipped':
      return 'yellow';
    default:
      return 'gray';
  }
}

/**
 * Get status label for display
 */
function getStatusLabel(status: ScanReviewStatus): string {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'importing':
      return 'Importing...';
    case 'done':
      return 'Imported';
    case 'error':
      return 'Error';
    case 'skipped':
      return 'Skipped';
    default:
      return status;
  }
}

/**
 * Bulk-editable table for reviewing and importing scanned manga items
 *
 * Features:
 * - Checkbox selection for bulk operations
 * - Per-row action buttons (Wizard, Quick Add, Skip)
 * - Status badges and progress indicators
 * - Bulk action menu
 */
export const ScanReviewTable = memo<ScanReviewTableProps>(function ScanReviewTable({
  items,
  libraryId: _libraryId,
  onSelectionChange,
  onSelectAll,
  onImportWithWizard,
  onQuickAdd,
  onSkip,
  onDelete,
  onBulkImportWithWizard,
  onBulkQuickAdd,
  onClearAll,
  isImporting
}: ScanReviewTableProps): JSX.Element {
  // Calculate selection stats
  const stats = useMemo(() => {
    const pendingItems = items.filter(i => i.status === 'pending');
    const selectedItems = items.filter(i => i.selected && i.status === 'pending');
    const doneItems = items.filter(i => i.status === 'done');
    const errorItems = items.filter(i => i.status === 'error');

    return {
      total: items.length,
      pending: pendingItems.length,
      selected: selectedItems.length,
      done: doneItems.length,
      errors: errorItems.length,
      allSelected: pendingItems.length > 0 && pendingItems.every(i => i.selected)
    };
  }, [items]);

  const handleSelectAllChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
    onSelectAll(event.currentTarget.checked);
  }, [onSelectAll]);

  // Empty state
  if (items.length === 0) {
    return (
      <Paper withBorder p="xl" radius="md">
        <Stack align="center" gap="md">
          <Text size="lg" c="dimmed">No items to review</Text>
          <Text size="sm" c="dimmed">Scan a directory to see manga items here</Text>
        </Stack>
      </Paper>
    );
  }

  return (
    <Stack gap="md">
      {/* Summary Stats */}
      <Paper withBorder p="sm" radius="md">
        <Group justify="space-between">
          <Group gap="lg">
            <Text size="sm">
              <Text span fw={600}>{stats.total}</Text> items found
            </Text>
            {stats.done > 0 && (
              <Badge color="green" variant="light">
                {stats.done} imported
              </Badge>
            )}
            {stats.errors > 0 && (
              <Badge color="red" variant="light">
                {stats.errors} errors
              </Badge>
            )}
            {stats.selected > 0 && (
              <Badge color="blue" variant="light">
                {stats.selected} selected
              </Badge>
            )}
          </Group>

          {/* Bulk Actions */}
          <Group gap="xs">
            {stats.selected > 0 && (
              <>
                <Button
                  size="xs"
                  variant="light"
                  color="blue"
                  leftSection={<IconSearch size={14} />}
                  onClick={onBulkImportWithWizard}
                  disabled={isImporting}
                >
                  Import Selected ({stats.selected})
                </Button>
                <Button
                  size="xs"
                  variant="light"
                  color="green"
                  leftSection={<IconRocket size={14} />}
                  onClick={onBulkQuickAdd}
                  disabled={isImporting}
                >
                  Quick Add Selected
                </Button>
              </>
            )}
            <Menu shadow="md" width={200}>
              <Menu.Target>
                <ActionIcon variant="subtle" size="lg">
                  <IconDotsVertical size={18} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item
                  leftSection={<IconPlayerPlay size={14} />}
                  onClick={() => onSelectAll(true)}
                  disabled={stats.allSelected}
                >
                  Select All Pending
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconX size={14} />}
                  onClick={() => onSelectAll(false)}
                  disabled={stats.selected === 0}
                >
                  Deselect All
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item
                  color="red"
                  leftSection={<IconTrash size={14} />}
                  onClick={onClearAll}
                >
                  Clear All Items
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </Paper>

      {/* Progress indicator during import */}
      {isImporting && (
        <Alert color="blue" icon={<IconLoader2 size={16} />}>
          Import in progress... Please wait.
        </Alert>
      )}

      {/* Table */}
      <Paper withBorder radius="md">
        <ScrollArea h={400}>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={40}>
                  <Checkbox
                    checked={stats.allSelected}
                    indeterminate={stats.selected > 0 && !stats.allSelected}
                    onChange={handleSelectAllChange}
                    disabled={isImporting || stats.pending === 0}
                  />
                </Table.Th>
                <Table.Th>Title</Table.Th>
                <Table.Th w={80}>Chapters</Table.Th>
                <Table.Th w={80}>Size</Table.Th>
                <Table.Th w={100}>Status</Table.Th>
                <Table.Th w={150}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {items.map((item) => (
                <Table.Tr
                  key={item.id}
                  style={
                    item.status === 'done' ? { backgroundColor: 'var(--mantine-color-green-light)' } :
                    item.status === 'error' ? { backgroundColor: 'var(--mantine-color-red-light)' } : undefined
                  }
                >
                  <Table.Td>
                    <Checkbox
                      checked={item.selected}
                      onChange={(e) => onSelectionChange(item.id, e.currentTarget.checked)}
                      disabled={isImporting || item.status !== 'pending'}
                    />
                  </Table.Td>
                  <Table.Td>
                    <Stack gap={2}>
                      <Text size="sm" fw={500} lineClamp={1}>
                        {item.parsedTitle}
                      </Text>
                      <Text size="xs" c="dimmed" lineClamp={1}>
                        {item.path}
                      </Text>
                      {item.errorMessage && (
                        <Text size="xs" c="red">
                          {item.errorMessage}
                        </Text>
                      )}
                    </Stack>
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="light" size="sm">
                      {item.chapters} ch
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" c="dimmed">
                      {formatFileSize(item.fileSize)}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge
                      color={getStatusColor(item.status)}
                      variant="light"
                      leftSection={
                        item.status === 'importing' ? <IconLoader2 size={12} /> :
                        item.status === 'done' ? <IconCheck size={12} /> :
                        item.status === 'error' ? <IconAlertCircle size={12} /> : null
                      }
                    >
                      {getStatusLabel(item.status)}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    {item.status === 'pending' && (
                      <Group gap={4} wrap="nowrap">
                        <Tooltip label="Import with Wizard">
                          <ActionIcon
                            variant="light"
                            color="blue"
                            size="sm"
                            onClick={() => onImportWithWizard(item)}
                            disabled={isImporting}
                          >
                            <IconSearch size={14} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Quick Add">
                          <ActionIcon
                            variant="light"
                            color="green"
                            size="sm"
                            onClick={() => onQuickAdd(item)}
                            disabled={isImporting}
                          >
                            <IconRocket size={14} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Skip">
                          <ActionIcon
                            variant="light"
                            color="gray"
                            size="sm"
                            onClick={() => onSkip(item.id)}
                            disabled={isImporting}
                          >
                            <IconX size={14} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Delete from list">
                          <ActionIcon
                            variant="light"
                            color="red"
                            size="sm"
                            onClick={() => onDelete(item.id)}
                            disabled={isImporting}
                          >
                            <IconTrash size={14} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    )}
                    {item.status === 'skipped' && (
                      <Tooltip label="Delete from list">
                        <ActionIcon
                          variant="light"
                          color="red"
                          size="sm"
                          onClick={() => onDelete(item.id)}
                          disabled={isImporting}
                        >
                          <IconTrash size={14} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                    {item.status === 'done' && item.importedMangaId && (
                      <Button
                        size="xs"
                        variant="subtle"
                        component="a"
                        href={`/manga/${item.importedMangaId}`}
                      >
                        View Manga
                      </Button>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Paper>
    </Stack>
  );
});

ScanReviewTable.displayName = 'ScanReviewTable';
