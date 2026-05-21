/**
 * ChapterFileTable Component
 *
 * Table for assigning files to individual chapters with selection support.
 * Displays chapters in a scrollable table with checkboxes for selection,
 * title tooltips, and file assignment dropdowns.
 *
 * @module components/manga/manual-import/components/ChapterFileTable
 */

import React from 'react';

import {
  ScrollArea,
  Table,
  Checkbox,
  Text,
  Tooltip,
  Select
} from '@mantine/core';
import { IconFileCheck } from '@tabler/icons-react';

import type { Chapter, ChapterFileMapping } from '../types';

interface FileOption {
  value: string;
  label: string;
}

interface ChapterFileTableProps {
  chapters: Chapter[];
  fileOptions: FileOption[];
  chapterFileMapping: ChapterFileMapping;
  selectedChapters: Set<number>;
  onToggleChapter: (chapterId: number) => void;
  onSelectAll: () => void;
  onAssignFile: (chapterId: number, filePath: string | null) => void;
}

export function ChapterFileTable({
  chapters,
  fileOptions,
  chapterFileMapping,
  selectedChapters,
  onToggleChapter,
  onSelectAll,
  onAssignFile
}: ChapterFileTableProps): React.ReactElement {
  return (
    <ScrollArea h={400}>
      <Table striped highlightOnHover withTableBorder>
        <thead>
          <tr>
            <th style={{ width: '5%' }}>
              <Checkbox
                checked={selectedChapters.size === chapters.length && chapters.length > 0}
                indeterminate={selectedChapters.size > 0 && selectedChapters.size < chapters.length}
                onChange={onSelectAll}
                aria-label="Select all chapters"
              />
            </th>
            <th style={{ width: '15%' }}>Chapter</th>
            <th style={{ width: '40%' }}>Title</th>
            <th style={{ width: '35%' }}>File</th>
            <th style={{ width: '5%' }}></th>
          </tr>
        </thead>
        <tbody>
          {chapters.map((chapter) => {
            const assignedFile = chapterFileMapping[chapter.id];

            return (
              <tr key={chapter.id}>
                <td>
                  <Checkbox
                    checked={selectedChapters.has(chapter.id)}
                    onChange={() => onToggleChapter(chapter.id)}
                    aria-label={`Select chapter ${chapter.chapterNumber ?? chapter.index + 1}`}
                  />
                </td>
                <td>
                  <Text size="sm" fw={500}>
                    Ch {chapter.chapterNumber ?? chapter.index + 1}
                  </Text>
                </td>
                <td>
                  <Tooltip label={chapter.title} withinPortal>
                    <Text size="sm" lineClamp={1}>{chapter.title}</Text>
                  </Tooltip>
                </td>
                <td>
                  <Select
                    placeholder="Select file"
                    data={fileOptions}
                    value={assignedFile ?? null}
                    onChange={(val) => onAssignFile(chapter.id, val)}
                    searchable
                    clearable
                    size="xs"
                  />
                </td>
                <td>
                  {assignedFile && (
                    <Tooltip label="File assigned" withinPortal>
                      <IconFileCheck size={18} color="green" />
                    </Tooltip>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </ScrollArea>
  );
}
