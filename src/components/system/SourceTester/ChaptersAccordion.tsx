/**
 * ChaptersAccordion component for displaying manga chapters
 *
 * Displays chapters in an expandable accordion with:
 * - Chapter titles and numbers
 * - Release dates
 * - Download and info actions
 */
import React from 'react';

import { Box, Divider, Accordion, Group, Text, Tooltip, ActionIcon } from '@mantine/core';
import { IconDownload, IconInfoCircle } from '@tabler/icons-react';

import type { MangaResult, ChapterResult } from './types';

export interface ChaptersAccordionProps {
  /** Selected manga with chapters */
  selectedManga: MangaResult;
}

/**
 * ChaptersAccordion component
 * Renders an accordion list of chapters for the selected manga
 */
export function ChaptersAccordion({ selectedManga }: ChaptersAccordionProps): React.ReactElement | null {
  if (!selectedManga.chapters || selectedManga.chapters.length === 0) {
    return null;
  }

  return (
    <Box mt="xl">
      <Divider
        my="md"
        label={`Chapters for ${selectedManga.title}`}
        labelPosition="center"
      />

      <Accordion>
        {selectedManga.chapters.map((chapter: ChapterResult, index: number) => (
          <Accordion.Item key={index} value={chapter.number}>
            <Accordion.Control>
              <Group justify="space-between">
                <Text>{chapter.title}</Text>
                {chapter.date && (
                  <Text size="xs" c="dimmed">
                    {chapter.date}
                  </Text>
                )}
              </Group>
            </Accordion.Control>
            <Accordion.Panel>
              <Group justify="space-between">
                <Text size="sm">Chapter {chapter.number}</Text>
                <Group>
                  <Tooltip label="Download Chapter">
                    <ActionIcon color="blue" variant="light">
                      <IconDownload size={16} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="View Details">
                    <ActionIcon color="gray" variant="light">
                      <IconInfoCircle size={16} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Group>
            </Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion>
    </Box>
  );
}
