/**
 * MatchFilesStep Component - Step 1: Match Files to Chapters/Volumes
 */

import type { JSX } from 'react';
import { memo } from 'react';

import {
  Stack,
  Paper,
  Text,
  Group,
  Badge,
  Progress,
  Table,
  ScrollArea,
  Loader,
  Alert,
  ActionIcon,
  Tooltip,
  NumberInput,
  Button,
  Image
} from '@mantine/core';
import {
  IconFile,
  IconRefresh,
  IconAlertCircle,
  IconArrowLeft,
  IconArrowRight,
  IconLink,
  IconX,
  IconCheck,
  IconEdit
} from '@tabler/icons-react';

import { trpc } from '@/utils/trpc-client';

import { getProviderColor } from '../utils/provider-formatting';

import type { FileInfo, MatchStats, SelectedSourceInfo } from '../types';

interface MatchFilesStepProps {
  selectedSourcesList: SelectedSourceInfo[];
  selectedSourcesCount: number;
  handleSetPrimary: (provider: string) => void;
  handleRemoveSource: (provider: string) => void;
  matchStats: MatchStats;
  files: FileInfo[];
  editingFileIndex: number | null;
  setEditingFileIndex: (index: number | null) => void;
  handleUpdateMatch: (index: number, chapter: number | undefined, volume: number | undefined) => void;
  directoryQuery: ReturnType<typeof trpc.files.listDirectory.useQuery>;
  metadataLoading: boolean;
  onNext: () => void;
  onBack: () => void;
}

export const MatchFilesStep = memo<MatchFilesStepProps>(function MatchFilesStep({
  selectedSourcesList,
  selectedSourcesCount,
  handleSetPrimary,
  handleRemoveSource,
  matchStats,
  files,
  editingFileIndex,
  setEditingFileIndex,
  handleUpdateMatch,
  directoryQuery,
  metadataLoading,
  onNext,
  onBack
}: MatchFilesStepProps): JSX.Element {
  return (
    <Stack gap="md">
      {/* Selected Sources Panel */}
      <Paper withBorder p="md" radius="md">
        <Stack gap="sm">
          <Group justify="space-between">
            <Text fw={600}>Selected Sources ({selectedSourcesCount})</Text>
            {metadataLoading && <Loader size="xs" />}
          </Group>
          <ScrollArea.Autosize mah={200}>
            <Stack gap="xs">
              {selectedSourcesList.map(({ provider, result, isPrimary }) => (
                <Paper
                  key={provider}
                  withBorder
                  p="xs"
                  radius="sm"
                  {...(isPrimary ? { bg: 'var(--mantine-color-blue-light)' } : {})}
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleSetPrimary(provider)}
                >
                  <Group gap="sm" wrap="nowrap" justify="space-between">
                    <Group gap="sm" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                      {result.coverImage && (
                        <Image src={result.coverImage} alt={result.title} w={40} h={60} radius="sm" fit="cover" />
                      )}
                      <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                        <Text size="sm" fw={500} truncate>{result.title}</Text>
                        <Group gap={4}>
                          <Badge size="xs" color={getProviderColor(provider)}>{provider}</Badge>
                          {isPrimary && <Badge size="xs" color="blue">Primary</Badge>}
                          {result.chapters && <Badge size="xs" variant="light">{result.chapters} ch</Badge>}
                          {result.volumes && <Badge size="xs" variant="light">{result.volumes} vol</Badge>}
                        </Group>
                      </Stack>
                    </Group>
                    <Tooltip label="Remove source">
                      <ActionIcon
                        variant="subtle"
                        size="sm"
                        color="red"
                        onClick={(e) => { e.stopPropagation(); handleRemoveSource(provider); }}
                      >
                        <IconX size={14} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Paper>
              ))}
            </Stack>
          </ScrollArea.Autosize>
          <Text size="xs" c="dimmed">Click a source to set it as primary. Primary source determines the main title and ID.</Text>
        </Stack>
      </Paper>

      {/* Match Stats */}
      <Paper withBorder p="md" radius="md">
        <Group justify="space-between" mb="xs">
          <Text fw={500} size="sm">File Matching</Text>
          <Group gap="xs">
            <Badge variant="light" color="green">{matchStats.auto} auto-matched</Badge>
            <Badge variant="light" color="blue">{matchStats.manual} manual</Badge>
            {matchStats.unmatched > 0 && <Badge variant="light" color="yellow">{matchStats.unmatched} unmatched</Badge>}
          </Group>
        </Group>
        <Progress
          value={(matchStats.matched / Math.max(matchStats.total, 1)) * 100}
          size="md"
          color={matchStats.unmatched === 0 ? 'green' : 'yellow'}
        />
        <Text size="xs" c="dimmed" mt={4}>
          {matchStats.matched} of {matchStats.total} files matched to chapters/volumes
        </Text>
      </Paper>

      {/* File Matching Table */}
      <Paper withBorder p="md" radius="md">
        <Group justify="space-between" mb="sm">
          <Group gap="xs">
            <IconFile size={16} />
            <Text fw={500} size="sm">Local Files</Text>
          </Group>
          <Tooltip label="Refresh files">
            <ActionIcon variant="subtle" size="sm" onClick={() => { void directoryQuery.refetch(); }} loading={directoryQuery.isRefetching}>
              <IconRefresh size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>

        {directoryQuery.isLoading ? (
          <Group justify="center" py="xl">
            <Loader size="sm" />
            <Text size="sm" c="dimmed">Loading files...</Text>
          </Group>
        ) : files.length === 0 ? (
          <Alert color="yellow" icon={<IconAlertCircle size={16} />}>No files found</Alert>
        ) : (
          <ScrollArea h={300}>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Filename</Table.Th>
                  <Table.Th style={{ width: '100px' }}>Detected</Table.Th>
                  <Table.Th style={{ width: '140px' }}>Matched To</Table.Th>
                  <Table.Th style={{ width: '80px' }}>Status</Table.Th>
                  <Table.Th style={{ width: '50px' }}></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {files.map((file, index) => (
                  <Table.Tr key={index}>
                    <Table.Td>
                      <Text size="xs" truncate style={{ maxWidth: '300px' }}>{file.name}</Text>
                    </Table.Td>
                    <Table.Td>
                      {file.detectedChapter !== undefined ? (
                        <Badge size="xs" variant="outline">Ch {file.detectedChapter}</Badge>
                      ) : file.detectedVolume !== undefined ? (
                        <Badge size="xs" variant="outline">Vol {file.detectedVolume}</Badge>
                      ) : (
                        <Text size="xs" c="dimmed">—</Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      {editingFileIndex === index ? (
                        <Group gap={4}>
                          <NumberInput
                            size="xs"
                            w={60}
                            placeholder="Ch"
                            value={file.matchedChapter ?? ''}
                            onChange={(val) => handleUpdateMatch(index, typeof val === 'number' ? val : undefined, file.matchedVolume)}
                            min={0}
                            step={1}
                          />
                          <NumberInput
                            size="xs"
                            w={60}
                            placeholder="Vol"
                            value={file.matchedVolume ?? ''}
                            onChange={(val) => handleUpdateMatch(index, file.matchedChapter, typeof val === 'number' ? val : undefined)}
                            min={0}
                            step={1}
                          />
                        </Group>
                      ) : (
                        <Group gap={4}>
                          {file.matchedChapter !== undefined && (
                            <Badge size="xs" variant="light" color="green">Ch {file.matchedChapter}</Badge>
                          )}
                          {file.matchedVolume !== undefined && (
                            <Badge size="xs" variant="light" color="blue">Vol {file.matchedVolume}</Badge>
                          )}
                          {file.matchedChapter === undefined && file.matchedVolume === undefined && (
                            <Text size="xs" c="dimmed">—</Text>
                          )}
                        </Group>
                      )}
                    </Table.Td>
                    <Table.Td>
                      {file.matchStatus === 'auto' && <IconLink size={14} color="var(--mantine-color-green-6)" />}
                      {file.matchStatus === 'manual' && <IconLink size={14} color="var(--mantine-color-blue-6)" />}
                      {file.matchStatus === 'unmatched' && <IconX size={14} color="var(--mantine-color-yellow-6)" />}
                    </Table.Td>
                    <Table.Td>
                      <Tooltip label={editingFileIndex === index ? "Save" : "Edit match"}>
                        <ActionIcon
                          variant="subtle"
                          size="sm"
                          onClick={() => setEditingFileIndex(editingFileIndex === index ? null : index)}
                        >
                          {editingFileIndex === index ? <IconCheck size={14} /> : <IconEdit size={14} />}
                        </ActionIcon>
                      </Tooltip>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        )}
      </Paper>

      {/* Step 1 Actions */}
      <Group justify="space-between">
        <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={onBack}>Back</Button>
        <Button rightSection={<IconArrowRight size={16} />} onClick={onNext}>
          Next: Review
        </Button>
      </Group>
    </Stack>
  );
});

MatchFilesStep.displayName = 'MatchFilesStep';
