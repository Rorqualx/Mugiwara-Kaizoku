/**
 * SelectedSourceCard Component - Display selected sources
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
  ActionIcon,
  Tooltip
} from '@mantine/core';
import { IconCheck, IconX } from '@tabler/icons-react';

import { getProviderColor } from '../utils/provider-formatting';

import type { SelectedSourceInfo } from '../types';

interface SelectedSourceCardProps {
  selectedSourcesList: SelectedSourceInfo[];
  selectedSourcesCount: number;
  handleSetPrimary: (provider: string) => void;
  handleRemoveSource: (provider: string) => void;
}

export const SelectedSourceCard = memo<SelectedSourceCardProps>(function SelectedSourceCard({
  selectedSourcesList,
  selectedSourcesCount,
  handleSetPrimary,
  handleRemoveSource
}: SelectedSourceCardProps): JSX.Element {
  return (
    <Paper withBorder p="md" radius="md" bg="var(--mantine-color-green-light)">
      <Stack gap="sm">
        <Group gap="xs">
          <IconCheck size={16} color="var(--mantine-color-green-6)" />
          <Text fw={600}>Selected Sources ({selectedSourcesCount})</Text>
        </Group>
        {selectedSourcesList.map(({ provider, result, isPrimary }) => (
          <Paper key={provider} withBorder p="xs" radius="sm" {...(isPrimary ? { bg: 'var(--mantine-color-blue-light)' } : {})}>
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
                  </Group>
                </Stack>
              </Group>
              <Group gap={4}>
                {!isPrimary && (
                  <Tooltip label="Set as primary">
                    <ActionIcon variant="subtle" size="sm" onClick={() => handleSetPrimary(provider)}>
                      <IconCheck size={14} />
                    </ActionIcon>
                  </Tooltip>
                )}
                <Tooltip label="Remove source">
                  <ActionIcon variant="subtle" size="sm" color="red" onClick={() => handleRemoveSource(provider)}>
                    <IconX size={14} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </Group>
          </Paper>
        ))}
        <Text size="xs" c="dimmed">
          Click results above to add more sources. The primary source will be used for the main title and ID.
        </Text>
      </Stack>
    </Paper>
  );
});

SelectedSourceCard.displayName = 'SelectedSourceCard';
