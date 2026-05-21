/**
 * Batch Metadata Editor - Manga Item Component
 *
 * Displays a manga entry with:
 * - Expandable/collapsible UI
 * - Loading and error states
 * - List of provider matches
 * - Skip option
 *
 * Extracted from: BatchMetadataEditor.tsx (lines 233-295)
 */

import React from 'react';

import {
  Card,
  Stack,
  Group,
  Text,
  ActionIcon,
  Box,
  Loader,
  Tooltip,
  Alert,
  Button,
  RadioGroup,
  Radio,
  Collapse,
} from '@mantine/core';
import {
  IconChevronDown,
  IconChevronRight,
  IconAlertCircle,
  IconCheck,
  IconInfoCircle,
} from '@tabler/icons-react';

import { MatchCard } from './MatchCard';

import type { MangaForMatching, MangaMatchState } from '../types';

export interface MangaItemProps {
  state: MangaMatchState;
  isExpanded: boolean;
  onToggleExpanded: (mangaId: number) => void;
  onSelectMatch: (mangaId: number, matchId: string) => void;
  onRetry: (manga: MangaForMatching) => void;
}

export function MangaItem({
  state,
  isExpanded,
  onToggleExpanded,
  onSelectMatch,
  onRetry,
}: MangaItemProps): JSX.Element {
  return (
    <Card key={state.manga.id} withBorder>
      <Stack gap="sm">
        <Group justify="space-between">
          <Group gap="xs" style={{ flex: 1 }}>
            <ActionIcon
              variant="subtle"
              size="sm"
              onClick={() => onToggleExpanded(state.manga.id)}
            >
              {isExpanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
            </ActionIcon>

            <Box style={{ flex: 1 }}>
              <Text fw={500}>{state.manga.title}</Text>
              {state.manga.chaptersCount && (
                <Text size="sm" c="dimmed">
                  {state.manga.chaptersCount} chapters
                </Text>
              )}
            </Box>
          </Group>

          <Group gap="xs">
            {state.isLoading && <Loader size="sm" />}
            {state.error && (
              <Tooltip label={state.error}>
                <IconAlertCircle size={20} color="var(--mantine-color-red-6)" />
              </Tooltip>
            )}
            {state.selectedMatchId && (
              <IconCheck size={20} color="var(--mantine-color-green-6)" />
            )}
          </Group>
        </Group>

        <Collapse in={isExpanded}>
          {state.error ? (
            <Alert color="red" icon={<IconAlertCircle />}>
              <Group justify="space-between">
                <Text size="sm">{state.error}</Text>
                <Button size="xs" onClick={() => onRetry(state.manga)}>
                  Retry
                </Button>
              </Group>
            </Alert>
          ) : state.matches.length === 0 && !state.isLoading ? (
            <Alert color="yellow" icon={<IconInfoCircle />}>
              <Text size="sm">No matches found</Text>
            </Alert>
          ) : (
            <RadioGroup
              value={state.selectedMatchId ?? ''}
              onChange={(value) => onSelectMatch(state.manga.id, value)}
            >
              <Stack gap="xs">
                {state.matches.map((match) => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    isSelected={match.id === state.selectedMatchId}
                    onSelect={() => onSelectMatch(state.manga.id, match.id)}
                  />
                ))}

                {state.matches.length > 0 && (
                  <Card
                    withBorder
                    p="sm"
                    onClick={() => onSelectMatch(state.manga.id, '')}
                  >
                    <Group gap="sm">
                      <Radio value="" checked={!state.selectedMatchId} />
                      <Text size="sm" c="dimmed">
                        Skip metadata (keep as-is)
                      </Text>
                    </Group>
                  </Card>
                )}
              </Stack>
            </RadioGroup>
          )}
        </Collapse>
      </Stack>
    </Card>
  );
}
