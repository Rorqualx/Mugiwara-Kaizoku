/**
 * ReviewStep Component - Step 2: Review and Import
 */

import type { JSX } from 'react';
import { memo } from 'react';

import {
  Stack,
  Paper,
  Text,
  Group,
  Image,
  Badge,
  Divider,
  Alert,
  Button,
  Loader,
  Progress
} from '@mantine/core';
import {
  IconFolder,
  IconAlertCircle,
  IconArrowLeft,
  IconDownload
} from '@tabler/icons-react';

import type { QuickAddProgress } from '@/components/addManga/services/quickAddService';

import { getProviderColor } from '../utils/provider-formatting';

import type { MatchStats, SearchResult, SelectedSourceInfo } from '../types';

interface ReviewStepProps {
  selectedResult: SearchResult;
  selectedSourcesList: SelectedSourceInfo[];
  selectedSourcesCount: number;
  matchStats: MatchStats;
  itemPath: string;
  expectedChapters: number | undefined;
  expectedVolumes: number | undefined;
  isImporting: boolean;
  importProgress: QuickAddProgress | null;
  importError: string | null;
  onImport: () => void;
  onBack: () => void;
}

export const ReviewStep = memo<ReviewStepProps>(function ReviewStep({
  selectedResult,
  selectedSourcesList,
  selectedSourcesCount,
  matchStats,
  itemPath,
  expectedChapters,
  expectedVolumes,
  isImporting,
  importProgress,
  importError,
  onImport,
  onBack
}: ReviewStepProps): JSX.Element {
  return (
    <Stack gap="md">
      {/* Final Summary */}
      <Paper withBorder p="md" radius="md" bg="var(--mantine-color-blue-light)">
        <Group gap="md" wrap="nowrap">
          {selectedResult.coverImage && (
            <Image src={selectedResult.coverImage} alt={selectedResult.title} w={80} h={120} radius="sm" fit="cover" />
          )}
          <Stack gap="xs" style={{ flex: 1 }}>
            <Text size="lg" fw={600}>{selectedResult.title}</Text>
            <Group gap={8}>
              <Badge color={getProviderColor(selectedResult.provider)}>{selectedResult.provider}</Badge>
              <Badge variant="outline" color="blue">Primary</Badge>
              {expectedChapters && <Badge variant="light">{expectedChapters} chapters</Badge>}
              {expectedVolumes && <Badge variant="light">{expectedVolumes} volumes</Badge>}
            </Group>

            {/* Show additional sources */}
            {selectedSourcesCount > 1 && (
              <>
                <Text size="xs" c="dimmed" mt={4}>Additional sources:</Text>
                <Group gap={4}>
                  {selectedSourcesList
                    .filter(s => !s.isPrimary)
                    .map(({ provider }) => (
                      <Badge key={provider} size="xs" variant="light" color={getProviderColor(provider)}>
                        {provider}
                      </Badge>
                    ))}
                </Group>
              </>
            )}

            <Divider my="xs" />
            <Group gap="lg">
              <Stack gap={2}>
                <Text size="xs" c="dimmed">Local Files</Text>
                <Text fw={600}>{matchStats.total}</Text>
              </Stack>
              <Stack gap={2}>
                <Text size="xs" c="dimmed">Matched</Text>
                <Text fw={600} c="green">{matchStats.matched}</Text>
              </Stack>
              <Stack gap={2}>
                <Text size="xs" c="dimmed">Unmatched</Text>
                <Text fw={600} c={matchStats.unmatched > 0 ? 'yellow' : 'dimmed'}>{matchStats.unmatched}</Text>
              </Stack>
              <Stack gap={2}>
                <Text size="xs" c="dimmed">Sources</Text>
                <Text fw={600}>{selectedSourcesCount}</Text>
              </Stack>
            </Group>
          </Stack>
        </Group>
      </Paper>

      {/* Directory Path */}
      <Paper withBorder p="sm" radius="md">
        <Group gap="xs">
          <IconFolder size={14} />
          <Text size="sm" c="dimmed">Source:</Text>
          <Text size="sm" truncate style={{ flex: 1 }}>{itemPath}</Text>
        </Group>
      </Paper>

      {/* Unmatched Warning */}
      {matchStats.unmatched > 0 && (
        <Alert color="yellow" icon={<IconAlertCircle size={16} />}>
          {matchStats.unmatched} file{matchStats.unmatched !== 1 ? 's' : ''} could not be matched to chapters/volumes.
          You can still import, but these files won&apos;t have chapter metadata.
        </Alert>
      )}

      {/* Import Progress */}
      {isImporting && importProgress && (
        <Paper withBorder p="md" radius="md">
          <Stack gap="xs">
            <Group justify="space-between">
              <Text size="sm" fw={500}>Importing...</Text>
              {importProgress.progress !== undefined && (
                <Text size="sm" c="dimmed">{importProgress.progress}%</Text>
              )}
            </Group>
            <Progress value={importProgress.progress ?? 0} size="sm" animated />
            <Text size="xs" c="dimmed">{importProgress.message}</Text>
          </Stack>
        </Paper>
      )}

      {/* Import Error */}
      {importError && (
        <Alert color="red" icon={<IconAlertCircle size={16} />} title="Import Failed">
          {importError}
        </Alert>
      )}

      {/* Step 2 Actions */}
      <Group justify="space-between">
        <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={onBack} disabled={isImporting}>
          Back
        </Button>
        <Button
          leftSection={isImporting ? <Loader size="xs" color="white" /> : <IconDownload size={16} />}
          onClick={onImport}
          color="green"
          loading={isImporting}
          disabled={isImporting}
        >
          {isImporting ? (importProgress?.message ?? 'Importing...') : 'Import to Library'}
        </Button>
      </Group>
    </Stack>
  );
});

ReviewStep.displayName = 'ReviewStep';
