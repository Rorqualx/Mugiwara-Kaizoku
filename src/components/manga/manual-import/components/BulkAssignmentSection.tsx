/**
 * BulkAssignmentSection Component
 *
 * Controls for bulk assigning files to chapter ranges or selections.
 *
 * @module components/manga/manual-import/components/BulkAssignmentSection
 */

import React from 'react';

import { Card, Stack, Group, Select, Button, Divider, Text } from '@mantine/core';

import type { Chapter } from '../types';

interface FileOption {
  value: string;
  label: string;
}

interface BulkAssignmentSectionProps {
  chapters: Chapter[];
  fileOptions: FileOption[];
  bulkFromChapter: number | null;
  bulkToChapter: number | null;
  bulkSelectedFile: string | null;
  selectedChaptersCount: number;
  onFromChapterChange: (value: number | null) => void;
  onToChapterChange: (value: number | null) => void;
  onFileChange: (value: string | null) => void;
  onApplyToRange: () => void;
  onApplyToSelected: () => void;
  onClearSelection: () => void;
}

export function BulkAssignmentSection(props: BulkAssignmentSectionProps): React.ReactElement {
  const {
    chapters, fileOptions, bulkFromChapter, bulkToChapter, bulkSelectedFile,
    selectedChaptersCount, onFromChapterChange, onToChapterChange, onFileChange,
    onApplyToRange, onApplyToSelected, onClearSelection
  } = props;
  // Build chapter options for selects
  const chapterOptions = chapters.map(ch => ({
    value: String(ch.id),
    label: `Ch ${ch.chapterNumber ?? ch.index + 1}: ${ch.title}`
  }));

  return (
    <Card withBorder p="sm">
      <Stack gap="sm">
        <Text size="sm" fw={500}>Assign Range</Text>
        <Group gap="sm" align="flex-end">
          <Select
            label="From Chapter"
            placeholder="Select"
            data={chapterOptions}
            value={bulkFromChapter !== null ? String(bulkFromChapter) : null}
            onChange={(val) => onFromChapterChange(val ? parseInt(val, 10) : null)}
            searchable
            style={{ flex: 1 }}
            size="xs"
          />
          <Select
            label="To Chapter"
            placeholder="Select"
            data={chapterOptions}
            value={bulkToChapter !== null ? String(bulkToChapter) : null}
            onChange={(val) => onToChapterChange(val ? parseInt(val, 10) : null)}
            searchable
            style={{ flex: 1 }}
            size="xs"
          />
          <Select
            label="File"
            placeholder="Select file"
            data={fileOptions}
            value={bulkSelectedFile}
            onChange={onFileChange}
            searchable
            style={{ flex: 2 }}
            size="xs"
          />
          <Button
            onClick={onApplyToRange}
            size="xs"
            disabled={!bulkSelectedFile || bulkFromChapter === null || bulkToChapter === null}
          >
            Apply to Range
          </Button>
        </Group>
        <Divider />
        <Group justify="space-between">
          <Text size="sm" fw={500}>
            Selected: {selectedChaptersCount} chapters
          </Text>
          <Group gap="xs">
            <Button
              variant="light"
              size="xs"
              onClick={onApplyToSelected}
              disabled={selectedChaptersCount === 0 || !bulkSelectedFile}
            >
              Apply to Selected
            </Button>
            <Button
              variant="subtle"
              size="xs"
              onClick={onClearSelection}
              disabled={selectedChaptersCount === 0}
            >
              Clear Selection
            </Button>
          </Group>
        </Group>
      </Stack>
    </Card>
  );
}
