/**
 * ImportOptionsSection — file-mode + per-import-options panel.
 * Extracted from ReviewStage.tsx to keep that file under the 500-line lint cap.
 */
import type { JSX } from 'react';

import { Paper, Stack, Group, Box, Text, SegmentedControl, Switch } from '@mantine/core';
import { IconHome, IconArrowRight, IconCopy } from '@tabler/icons-react';

import type { ImportOptions, FileMode } from '../types';

const FILE_MODE_DESCRIPTIONS: Record<FileMode, { label: string; description: string }> = {
  keep_in_place: {
    label: 'Keep in Place',
    description: 'Files stay in their original location. Library references them without moving.',
  },
  move: {
    label: 'Move',
    description: 'Files are moved to the library folder. Originals are deleted after copy.',
  },
  copy: {
    label: 'Copy',
    description: 'Files are copied to the library folder. Originals are kept.',
  },
};

export function ImportOptionsSection({ options, onChange }: {
  options: ImportOptions;
  onChange: (o: Partial<ImportOptions>) => void;
}): JSX.Element {
  const currentMode = FILE_MODE_DESCRIPTIONS[options.fileMode];
  return (
    <Paper p="md" withBorder>
      <Text size="sm" fw={500} mb="md">Import Options</Text>
      <Stack gap="md">
        <Box>
          <Text size="xs" fw={500} mb="xs" c="dimmed">File Handling Mode</Text>
          <SegmentedControl
            value={options.fileMode}
            onChange={(v) => onChange({ fileMode: v as FileMode })}
            fullWidth
            data={[
              { value: 'keep_in_place', label: <Group gap={4}><IconHome size={14} /><Text size="xs">Keep in Place</Text></Group> },
              { value: 'move', label: <Group gap={4}><IconArrowRight size={14} /><Text size="xs">Move</Text></Group> },
              { value: 'copy', label: <Group gap={4}><IconCopy size={14} /><Text size="xs">Copy</Text></Group> },
            ]}
          />
          <Text size="xs" c="dimmed" mt="xs">{currentMode.description}</Text>
        </Box>
        <Switch
          label="Create chapter entries"
          description="Auto-create chapter records from files"
          checked={options.createChapters}
          onChange={(e) => onChange({ createChapters: e.currentTarget.checked })}
        />
        <Switch
          label="Download covers"
          description="Fetch cover images from providers"
          checked={options.downloadCovers}
          onChange={(e) => onChange({ downloadCovers: e.currentTarget.checked })}
        />
        <Switch
          label="Add missing chapters to existing manga"
          description="Auto-select IN_LIBRARY rows whose on-disk files would create new chapters"
          checked={options.topUpExisting}
          onChange={(e) => onChange({ topUpExisting: e.currentTarget.checked })}
        />
      </Stack>
    </Paper>
  );
}
