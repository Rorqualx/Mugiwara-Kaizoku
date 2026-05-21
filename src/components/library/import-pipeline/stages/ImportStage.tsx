/**
 * ImportStage Component
 *
 * Stage 5: Execute import and show completion status.
 *
 * @module components/library/import-pipeline/stages/ImportStage
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
  ScrollArea,
  Table,
  ThemeIcon,
  Alert,
} from '@mantine/core';
import {
  IconCheck,
  IconX,
  IconLoader,
  IconHome,
  IconPlus,
  IconAlertCircle,
} from '@tabler/icons-react';

import type { MatchedMangaItem, ImportProgress, ImportResult, ImportStats } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface ImportStageProps {
  items: MatchedMangaItem[];
  progress: ImportProgress;
  results: Map<string, ImportResult>;
  stats: ImportStats;
  isComplete: boolean;
  onStartImport: () => void;
  onCancelImport: () => void;
  onViewManga: (mangaId: number) => void;
  onImportMore: () => void;
  onGoHome: () => void;
}

// ============================================================================
// Subcomponents
// ============================================================================

interface ProgressSectionProps {
  progress: ImportProgress;
  isComplete: boolean;
}

function ProgressSection({ progress, isComplete }: ProgressSectionProps): JSX.Element {
  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
  return (
    <Paper p="md" withBorder>
      <Group justify="space-between" mb="xs">
        <Text size="sm" fw={500}>
          {isComplete ? 'Import Complete' : progress.isImporting ? 'Importing...' : 'Ready to Import'}
        </Text>
        <Text size="sm" c="dimmed">{progress.current} / {progress.total}</Text>
      </Group>
      <Progress
        value={pct}
        animated={progress.isImporting}
        color={isComplete ? 'green' : 'blue'}
        size="lg"
      />
    </Paper>
  );
}

interface CompletionSummaryProps {
  stats: ImportStats;
}

function CompletionSummary({ stats }: CompletionSummaryProps): JSX.Element {
  return (
    <Paper p="lg" withBorder bg="var(--mantine-color-green-light)">
      <Stack align="center" gap="md">
        <ThemeIcon size={60} radius="xl" color="green">
          <IconCheck size={30} />
        </ThemeIcon>
        <Text size="xl" fw={600}>Import Complete!</Text>
        <Group gap="lg">
          <StatItem label="Imported" value={stats.success} color="green" />
          <StatItem label="Failed" value={stats.failed} color="red" />
          <StatItem label="Files" value={stats.chaptersCreated} color="blue" />
        </Group>
      </Stack>
    </Paper>
  );
}

function StatItem({ label, value, color }: { label: string; value: number; color: string }): JSX.Element {
  return (
    <Stack align="center" gap={4}>
      <Text size="2rem" fw={700} c={color}>{value}</Text>
      <Text size="sm" c="dimmed">{label}</Text>
    </Stack>
  );
}

interface ResultRowProps {
  item: MatchedMangaItem;
  result: ImportResult | undefined;
  onView: (mangaId: number) => void;
}

function ResultRow({ item, result, onView }: ResultRowProps): JSX.Element {
  return (
    <Table.Tr>
      <Table.Td>
        <Text size="sm" lineClamp={1}>{item.parsedTitle}</Text>
      </Table.Td>
      <Table.Td>
        <ResultStatusBadge result={result} />
      </Table.Td>
      <Table.Td>
        {result?.status === 'success' && result.chaptersCreated !== undefined && (
          <Text size="sm">{result.chaptersCreated} files</Text>
        )}
        {result?.status === 'error' && (
          <Text size="xs" c="red" lineClamp={1}>{result.error}</Text>
        )}
      </Table.Td>
      <Table.Td>
        {result?.status === 'success' && result.mangaId !== undefined && (
          <Button size="xs" variant="light" onClick={() => onView(result.mangaId as number)}>
            View
          </Button>
        )}
      </Table.Td>
    </Table.Tr>
  );
}

function ResultStatusBadge({ result }: { result: ImportResult | undefined }): JSX.Element {
  if (!result) return <Badge color="gray" size="sm">Pending</Badge>;
  switch (result.status) {
    case 'success':
      return <Badge color="green" size="sm" leftSection={<IconCheck size={10} />}>Success</Badge>;
    case 'error':
      return <Badge color="red" size="sm" leftSection={<IconX size={10} />}>Failed</Badge>;
    case 'importing':
      return <Badge color="blue" size="sm" leftSection={<IconLoader size={10} />}>Importing</Badge>;
    default:
      return <Badge color="gray" size="sm">Pending</Badge>;
  }
}

function CancelledAlert(): JSX.Element {
  return (
    <Alert icon={<IconAlertCircle size={16} />} title="Import Cancelled" color="yellow">
      The import was cancelled. Some items may have been partially imported.
    </Alert>
  );
}

// ============================================================================
// Main Component
// ============================================================================

function ImportStageComponent(props: ImportStageProps): JSX.Element {
  const {
    items, progress, results, stats, isComplete,
    onStartImport, onCancelImport, onViewManga, onImportMore, onGoHome,
  } = props;

  const showCompletion = isComplete && !progress.isCancelled;
  const showCancelled = progress.isCancelled;

  return (
    <Stack gap="lg">
      {showCompletion && <CompletionSummary stats={stats} />}
      {showCancelled && <CancelledAlert />}
      {!showCompletion && <ProgressSection progress={progress} isComplete={isComplete} />}

      <Paper p="md" withBorder>
        <Text size="sm" fw={500} mb="sm">Import Results</Text>
        <ScrollArea h={250}>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Title</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Details</Table.Th>
                <Table.Th></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {items.map((item) => (
                <ResultRow
                  key={item.id}
                  item={item}
                  result={results.get(item.id)}
                  onView={onViewManga}
                />
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Paper>

      <Group justify="center" mt="md">
        {!progress.isImporting && !isComplete && (
          <Button size="lg" onClick={onStartImport}>
            Start Import
          </Button>
        )}
        {progress.isImporting && (
          <Button size="lg" color="red" variant="light" onClick={onCancelImport}>
            Cancel Import
          </Button>
        )}
        {isComplete && (
          <>
            <Button
              size="lg"
              variant="light"
              leftSection={<IconPlus size={18} />}
              onClick={onImportMore}
            >
              Import More
            </Button>
            <Button
              size="lg"
              leftSection={<IconHome size={18} />}
              onClick={onGoHome}
            >
              Go to Library
            </Button>
          </>
        )}
      </Group>
    </Stack>
  );
}

export const ImportStage = memo(ImportStageComponent);
ImportStage.displayName = 'ImportStage';
