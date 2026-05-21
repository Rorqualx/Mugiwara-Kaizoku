/**
 * Auto-Assign Tab Component
 *
 * Shows preview of auto-assignment and applies it.
 *
 * @module components/volumeChapters/chapter-reassign-modal/AutoAssignTab
 */

import { memo, type JSX } from 'react';

import {
  Stack,
  Group,
  Text,
  Button,
  Paper,
  Badge,
  ScrollArea,
  Alert,
  Loader,
  Divider,
  ThemeIcon,
} from '@mantine/core';
import { IconRefresh, IconAlertCircle, IconBook } from '@tabler/icons-react';

import { trpc } from '@/utils/trpc-client';

import type { AutoAssignTabProps } from './types';

// ============================================================================
// Subcomponents
// ============================================================================

interface AssignmentRowProps {
  volumeNumber: number;
  volumeTitle: string | null;
  chapterRange: string | null;
  chapterCount: number;
}

function AssignmentRow({ volumeNumber, volumeTitle, chapterRange, chapterCount }: AssignmentRowProps): JSX.Element {
  return (
    <Paper p="sm" withBorder bg="dark.7">
      <Group justify="space-between">
        <Group gap="xs">
          <ThemeIcon size="sm" color="blue" variant="light">
            <IconBook size={14} />
          </ThemeIcon>
          <Text size="sm" fw={500}>
            Volume {volumeNumber}{volumeTitle ? `: ${volumeTitle}` : ''}
          </Text>
          {chapterRange && <Badge size="xs" variant="outline">{chapterRange}</Badge>}
        </Group>
        <Badge color="green" size="sm">
          {chapterCount} chapter{chapterCount !== 1 ? 's' : ''}
        </Badge>
      </Group>
    </Paper>
  );
}

// ============================================================================
// Main Component
// ============================================================================

function AutoAssignTabComponent({ mangaId, onApply, isApplying }: AutoAssignTabProps): JSX.Element {
  const { data: preview, isLoading } = trpc.chapter.previewAutoAssign.useQuery(
    { mangaId },
    { enabled: mangaId > 0 }
  );

  if (isLoading) {
    return (
      <Stack align="center" py="xl">
        <Loader size="lg" />
        <Text c="dimmed">Analyzing chapters and volumes...</Text>
      </Stack>
    );
  }

  if (!preview) {
    return (
      <Alert icon={<IconAlertCircle size={16} />} color="yellow">
        Could not load preview data.
      </Alert>
    );
  }

  const hasMatches = preview.wouldAssign > 0;
  const hasVolumesWithRanges = preview.volumesWithRanges > 0;
  const matchedAssignments = preview.assignments.filter(a => a.chapters.length > 0);

  return (
    <Stack gap="md">
      {!hasVolumesWithRanges && (
        <Alert icon={<IconAlertCircle size={16} />} color="yellow" title="No Volume Ranges">
          No volumes have chapter ranges defined. Auto-assign uses volume chapter ranges to match.
          Use manual assignment below, or set chapter ranges on your volumes.
        </Alert>
      )}

      <Paper p="md" withBorder>
        <Group justify="space-between" mb="md">
          <Text fw={500}>Preview Summary</Text>
          <Group gap="xs">
            <Badge color="blue">{preview.totalUnassigned} unassigned</Badge>
            <Badge color="green">{preview.wouldAssign} would match</Badge>
            <Badge color="gray">{preview.wouldRemainUnassigned} unmatched</Badge>
          </Group>
        </Group>

        {hasMatches && (
          <ScrollArea h={200}>
            <Stack gap="xs">
              {matchedAssignments.map(a => (
                <AssignmentRow
                  key={a.volumeNumber}
                  volumeNumber={a.volumeNumber}
                  volumeTitle={a.volumeTitle}
                  chapterRange={a.chapterRange}
                  chapterCount={a.chapters.length}
                />
              ))}
            </Stack>
          </ScrollArea>
        )}

        {preview.unmatched.length > 0 && (
          <>
            <Divider my="sm" label="Unmatched (use manual assignment)" labelPosition="center" />
            <Text size="xs" c="dimmed">
              {preview.unmatched.length} chapter{preview.unmatched.length !== 1 ? 's' : ''} unmatched:
              {' '}{preview.unmatched.slice(0, 5).map(c => c.title).join(', ')}
              {preview.unmatched.length > 5 ? '...' : ''}
            </Text>
          </>
        )}
      </Paper>

      <Group justify="flex-end">
        <Button
          leftSection={<IconRefresh size={16} />}
          onClick={onApply}
          loading={isApplying}
          disabled={!hasMatches}
        >
          Apply Auto-Assign ({preview.wouldAssign} chapters)
        </Button>
      </Group>
    </Stack>
  );
}

export const AutoAssignTab = memo(AutoAssignTabComponent);
AutoAssignTab.displayName = 'AutoAssignTab';
