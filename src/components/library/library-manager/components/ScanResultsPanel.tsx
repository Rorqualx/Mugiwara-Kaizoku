/**
 * Scan Results Panel Component
 *
 * Displays library scan results including:
 * - Live progress during scanning
 * - Summary statistics after completion
 * - Detailed item view in modal
 *
 * @module components/library/library-manager/components/ScanResultsPanel
 */

import { memo, useEffect } from 'react';

import {
  Stack,
  Group,
  Text,
  Badge,
  Progress,
  Alert,
  SimpleGrid,
  Paper,
  ThemeIcon,
  Table,
  ScrollArea,
  Button
} from '@mantine/core';
import {
  IconCheck,
  IconAlertCircle,
  IconFiles,
  IconPlus,
  IconPlayerSkipForward,
  IconX,
  IconDownload
} from '@tabler/icons-react';

import { useRealTime } from '@/providers/RealTimeProvider';
import { trpc } from '@/utils/trpc-client';

/**
 * Props for the ScanResultsPanel component
 */
interface ScanResultsPanelProps {
  /** Library ID to show scan results for */
  libraryId: number;
  /** Whether a scan is currently in progress */
  scanning: boolean;
  /** Callback when user clicks Import on an item */
  onItemImport?: (item: ScanItemSummary) => void;
}

/**
 * Scan result data structure (matches what we store in jobs.result)
 */
interface ScanResultData {
  totalFiles: number;
  processed: number;
  created: number;
  skipped: number;
  errors: number;
  items: ScanItemSummary[];
}

/**
 * Summary of a single scanned item
 */
export interface ScanItemSummary {
  path: string;
  title: string;
  originalName?: string;
  status: 'created' | 'exists' | 'error' | 'preview' | 'enriched';
  error: string | null;
  chapters: number;
  /** Total file size in bytes for the manga directory/files */
  fileSize?: number;
  enriched: boolean;
  // Additional details
  mangaId?: number | null;
  provider?: string | null;
  matchedTitle?: string | null;
  confidence?: number | null;
  requiresUserSelection?: boolean;
  matchCount?: number;
  // Parsed metadata
  year?: number | null;
  group?: string | null;
  language?: string | null;
}

/**
 * Get badge color for job status
 */
function getStatusColor(status: string): string {
  switch (status) {
    case 'completed':
      return 'green';
    case 'active':
    case 'pending':
      return 'blue';
    case 'failed':
      return 'red';
    case 'cancelled':
      return 'gray';
    default:
      return 'gray';
  }
}

/**
 * Format date for display
 */
function formatDate(date: Date | string | null): string {
  if (!date) return 'Unknown';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString();
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
    <Paper withBorder p="md" radius="md">
      <Group justify="space-between" mb="xs">
        <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
          {label}
        </Text>
        <ThemeIcon color={color} variant="light" size="sm">
          {icon}
        </ThemeIcon>
      </Group>
      <Text fw={700} size="xl">
        {value}
      </Text>
    </Paper>
  );
}

/**
 * Panel displaying library scan results
 *
 * Shows:
 * - Progress bar during active scan
 * - Summary statistics after completion
 * - Button to view detailed item list
 */
/**
 * Get badge color for item status
 */
function getItemStatusColor(status: string): string {
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
 * Get display label for item status
 */
function getItemStatusLabel(status: string): string {
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

// eslint-disable-next-line complexity -- Panel manages many states: scanning, results, selection, import
export const ScanResultsPanel = memo<ScanResultsPanelProps>(function ScanResultsPanel({
  libraryId,
  scanning,
  onItemImport
}: ScanResultsPanelProps): JSX.Element | null {
  // WebSocket connection for real-time updates
  const { isConnected, subscribe } = useRealTime();

  // Poll for latest scan job while scanning (only when WebSocket disconnected)
  const { data: latestScan, refetch } = trpc.jobs.getLatestScanForLibrary.useQuery(
    { libraryId },
    {
      refetchInterval: scanning && !isConnected ? 2000 : false,
      enabled: libraryId > 0
    }
  );

  // Subscribe to WebSocket library scan events for real-time updates
  useEffect(() => {
    if (!isConnected || !scanning) return;

    const unsubscribe = subscribe('library:scan', () => {
      void refetch();
    });

    return unsubscribe;
  }, [isConnected, subscribe, scanning, refetch]);

  // Don't render if no scan data
  if (!latestScan) {
    return (
      <Paper withBorder p="md" radius="md">
        <Text c="dimmed" ta="center">No scan history for this library</Text>
      </Paper>
    );
  }

  const rawResult = latestScan.result as ScanResultData | null;

  // Validate that result has the expected structure (not just processingTimeMs)
  const result = rawResult && typeof rawResult.totalFiles === 'number' ? rawResult : null;

  return (
    <Stack gap="md">
      {/* Status Header */}
      <Group justify="space-between">
        <Text fw={500}>Last Scan</Text>
        <Badge color={getStatusColor(latestScan.status)} size="lg">
          {latestScan.status}
        </Badge>
      </Group>

      {/* Progress (while scanning) */}
      {(latestScan.status === 'active' || latestScan.status === 'pending') && (
        <Stack gap="xs">
          <Progress
            value={latestScan.progress ?? 0}
            animated
            size="lg"
            color="blue"
          />
          <Text size="sm" c="dimmed" ta="center">
            {latestScan.progress ?? 0}% complete
          </Text>
        </Stack>
      )}

      {/* Completed but no detailed data (legacy scan) */}
      {!result && latestScan.status === 'completed' && (
        <Alert color="green" icon={<IconCheck size={16} />}>
          Scan completed at {formatDate(latestScan.completed_at)}
          <Text size="sm" c="dimmed" mt="xs">
            Run a new scan to see detailed results.
          </Text>
        </Alert>
      )}

      {/* Results Summary (when completed with valid data) */}
      {result && latestScan.status === 'completed' && (
        <>
          <Alert color="green" icon={<IconCheck size={16} />}>
            Scan completed at {formatDate(latestScan.completed_at)}
          </Alert>

          <SimpleGrid cols={{ base: 2, sm: 4 }}>
            <StatCard
              label="Total Files"
              value={result.totalFiles}
              color="gray"
              icon={<IconFiles size={14} />}
            />
            <StatCard
              label="Created"
              value={result.created}
              color="green"
              icon={<IconPlus size={14} />}
            />
            <StatCard
              label="Skipped"
              value={result.skipped}
              color="blue"
              icon={<IconPlayerSkipForward size={14} />}
            />
            <StatCard
              label="Errors"
              value={result.errors}
              color="red"
              icon={<IconX size={14} />}
            />
          </SimpleGrid>

          {/* Detailed Items Table */}
          {result.items.length > 0 && (
            <Paper withBorder p="md" radius="md">
              <Text fw={500} mb="sm">Scanned Items</Text>
              <ScrollArea h={300}>
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Title</Table.Th>
                      <Table.Th>Match</Table.Th>
                      <Table.Th>Chapters</Table.Th>
                      <Table.Th>Status</Table.Th>
                      {onItemImport && <Table.Th>Action</Table.Th>}
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {result.items
                      .filter(item => item.status !== 'exists')
                      .map((item) => (
                        <Table.Tr key={item.path}>
                          <Table.Td style={{ maxWidth: '250px' }}>
                            <Text fw={500} size="sm" truncate>
                              {item.title}
                            </Text>
                            <Text size="xs" c="dimmed" truncate>
                              {item.path.split('/').slice(-2).join('/')}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            {item.matchedTitle ? (
                              <Stack gap={2}>
                                <Text size="sm" truncate style={{ maxWidth: '150px' }}>
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
                            <Badge color={getItemStatusColor(item.status)} size="sm">
                              {getItemStatusLabel(item.status)}
                            </Badge>
                          </Table.Td>
                          {onItemImport && (
                            <Table.Td>
                              <Button
                                size="xs"
                                variant="light"
                                leftSection={<IconDownload size={14} />}
                                onClick={() => onItemImport(item)}
                              >
                                Import
                              </Button>
                            </Table.Td>
                          )}
                        </Table.Tr>
                      ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
              {result.items.filter(item => item.status === 'exists').length > 0 && (
                <Text size="xs" c="dimmed" mt="xs">
                  {result.items.filter(item => item.status === 'exists').length} items already exist in library (hidden)
                </Text>
              )}
            </Paper>
          )}
        </>
      )}

      {/* Error State */}
      {latestScan.status === 'failed' && (
        <Alert color="red" icon={<IconAlertCircle size={16} />}>
          Scan failed: {
            typeof latestScan.last_error === 'object' && latestScan.last_error !== null
              ? (latestScan.last_error as { message?: string }).message ?? 'Unknown error'
              : String(latestScan.last_error ?? 'Unknown error')
          }
        </Alert>
      )}
    </Stack>
  );
});

ScanResultsPanel.displayName = 'ScanResultsPanel';
