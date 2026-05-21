/**
 * ScanDetectStage Component
 *
 * Stage 2: Show scan progress and detected manga files.
 *
 * @module components/library/import-pipeline/stages/ScanDetectStage
 */

import { memo, type JSX } from 'react';

import {
  Stack,
  Group,
  Button,
  Text,
  Paper,
  Progress,
  Badge,
  Table,
  ScrollArea,
} from '@mantine/core';
import { IconArrowLeft, IconArrowRight, IconX, IconCheck, IconAlertCircle } from '@tabler/icons-react';

import type { ScannedMangaItem, ScanStats, ScanProgress } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface ScanDetectStageProps {
  progress: ScanProgress;
  items: ScannedMangaItem[];
  stats: ScanStats;
  isScanning: boolean;
  onCancel: () => void;
  onNext: () => void;
  onBack: () => void;
  canProceed: boolean;
}

// ============================================================================
// Subcomponents
// ============================================================================

interface StatsCardsProps {
  stats: ScanStats;
}

function StatsCards({ stats }: StatsCardsProps): JSX.Element {
  return (
    <Group gap="md">
      <StatCard label="Found" value={stats.total} color="blue" />
      <StatCard label="Ready" value={stats.ready} color="green" />
      <StatCard label="Duplicates" value={stats.duplicates} color="yellow" />
      <StatCard label="Errors" value={stats.errors} color="red" />
    </Group>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  color: string;
}

function StatCard({ label, value, color }: StatCardProps): JSX.Element {
  return (
    <Paper p="sm" withBorder style={{ minWidth: 80, textAlign: 'center' }}>
      <Text size="xl" fw={700} c={color}>
        {value}
      </Text>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
    </Paper>
  );
}

interface ItemsTableProps {
  items: ScannedMangaItem[];
}

function ItemsTable({ items }: ItemsTableProps): JSX.Element {
  if (items.length === 0) {
    return (
      <Text size="sm" c="dimmed" ta="center" py="xl">
        No manga detected yet...
      </Text>
    );
  }

  return (
    <ScrollArea h={300}>
      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Title</Table.Th>
            <Table.Th>Files</Table.Th>
            <Table.Th>Status</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {items.map((item) => (
            <ItemRow key={item.id} item={item} />
          ))}
        </Table.Tbody>
      </Table>
    </ScrollArea>
  );
}

interface ItemRowProps {
  item: ScannedMangaItem;
}

function ItemRow({ item }: ItemRowProps): JSX.Element {
  return (
    <Table.Tr>
      <Table.Td>
        <Text size="sm" fw={500} lineClamp={1}>
          {item.parsedTitle}
        </Text>
        <Text size="xs" c="dimmed" lineClamp={1}>
          {item.path}
        </Text>
      </Table.Td>
      <Table.Td>
        <Text size="sm">{item.fileCount}</Text>
      </Table.Td>
      <Table.Td>
        <StatusBadge item={item} />
      </Table.Td>
    </Table.Tr>
  );
}

function StatusBadge({ item }: { item: ScannedMangaItem }): JSX.Element {
  if (item.error) {
    return (
      <Badge color="red" size="sm" leftSection={<IconAlertCircle size={12} />}>
        Error
      </Badge>
    );
  }

  if (item.isDuplicate) {
    return (
      <Badge color="yellow" size="sm" leftSection={<IconX size={12} />}>
        Duplicate
      </Badge>
    );
  }

  return (
    <Badge color="green" size="sm" leftSection={<IconCheck size={12} />}>
      Ready
    </Badge>
  );
}

// ============================================================================
// Main Component
// ============================================================================

function ScanDetectStageComponent({
  progress,
  items,
  stats,
  isScanning,
  onCancel,
  onNext,
  onBack,
  canProceed,
}: ScanDetectStageProps): JSX.Element {
  const percentage = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <Stack gap="lg">
      {/* Progress Section */}
      <Paper p="md" withBorder>
        <Stack gap="sm">
          <Group justify="space-between">
            <Text size="sm" fw={500}>
              {progress.status}
            </Text>
            <Text size="sm" c="dimmed">
              {isScanning ? `${percentage}%` : 'Complete'}
            </Text>
          </Group>

          <Progress value={percentage} animated={isScanning} size="lg" />

          {progress.currentItem && (
            <Text size="xs" c="dimmed" lineClamp={1}>
              Processing: {progress.currentItem}
            </Text>
          )}
        </Stack>
      </Paper>

      {/* Stats */}
      <StatsCards stats={stats} />

      {/* Items Table */}
      <Paper p="md" withBorder>
        <Text size="sm" fw={500} mb="sm">
          Detected Manga ({items.length})
        </Text>
        <ItemsTable items={items} />
      </Paper>

      {/* Actions */}
      <Group justify="space-between" mt="md">
        <Group>
          <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={onBack}>
            Back
          </Button>
          {isScanning && (
            <Button variant="light" color="red" onClick={onCancel}>
              Cancel Scan
            </Button>
          )}
        </Group>

        <Button
          rightSection={<IconArrowRight size={16} />}
          onClick={onNext}
          disabled={!canProceed || isScanning}
        >
          Continue to Matching
        </Button>
      </Group>
    </Stack>
  );
}

export const ScanDetectStage = memo(ScanDetectStageComponent);
ScanDetectStage.displayName = 'ScanDetectStage';
