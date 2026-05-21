/**
 * ReaderToolbar Component
 *
 * Persistent toolbar for reader navigation and controls.
 * Shows chapter navigation, page counter, progress, and action buttons.
 */

import React from 'react';

import { ActionIcon, Button, Group, Menu, Progress, Text, Tooltip } from '@mantine/core';
import {
  IconArrowLeft,
  IconArrowRight,
  IconBookmark,
  IconChevronLeft,
  IconChevronRight,
  IconFile,
  IconHome,
  IconList,
  IconSettings,
  IconZoomIn,
} from '@tabler/icons-react';

import { useNavigation } from '@/hooks/useNavigation';
import type { MangaFile } from '@/types/reader/reader-types';
import {
  CHAPTER_MENU_WIDTH,
  CHAPTER_MENU_MAX_HEIGHT,
  PROGRESS_BAR_WIDTH
} from '@/utils/reader/constants';

interface ChapterNavigation {
  prevChapter: { id: number; index: number; title: string | null; pageCount: number | null } | null | undefined;
  currentChapter: { id: number; index: number; title: string | null; pageCount: number | null } | null | undefined;
  nextChapter: { id: number; index: number; title: string | null; pageCount: number | null } | null | undefined;
  totalChapters: number;
  currentIndex: number;
  chapters: Array<{ id: number; index: number; title: string | null; pageCount: number | null }>;
}

/** File source info for the source toggle */
interface FileSource {
  id: number;
  fileName: string;
  sourceType: string;
  isActive: boolean;
}

interface ReaderToolbarProps {
  visible: boolean;
  fullscreen: boolean;
  mangaId: string | string[] | undefined;
  file: MangaFile;
  currentPage: number;
  totalPages: number;
  chapterNavigation: ChapterNavigation | null;
  prevPage: () => void;
  nextPage: () => void;
  prevChapter: () => Promise<void>;
  nextChapter: () => Promise<void>;
  jumpToChapter: (chapterId: number) => Promise<void>;
  isBookmarked: boolean;
  toggleBookmark: () => void;
  toggleFullscreen: () => Promise<void>;
  setSettingsOpen: (open: boolean) => void;
  /** Available file sources for source toggle (only shown when > 1) */
  fileSources?: FileSource[];
  /** Callback when user switches file source */
  onSwitchSource?: (chapterFileId: number) => void;
}

export function ReaderToolbar({
  visible,
  fullscreen,
  mangaId,
  file,
  currentPage,
  totalPages,
  chapterNavigation,
  prevPage,
  nextPage,
  prevChapter,
  nextChapter,
  jumpToChapter,
  isBookmarked,
  toggleBookmark,
  toggleFullscreen,
  setSettingsOpen,
  fileSources,
  onSwitchSource,
}: ReaderToolbarProps): React.JSX.Element | null {
  const { navigateTo } = useNavigation();

  if (!visible || fullscreen) {
    return null;
  }

  return (
    <Group
      justify="space-between"
      p="sm"
      style={{
        background: 'rgba(0, 0, 0, 0.8)',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
      }}
    >
      {/* Left section */}
      <Group>
        <Tooltip label="Back to manga">
          <ActionIcon
            variant="subtle"
            onClick={() => {
              void navigateTo(`/manga/${mangaId}`);
            }}
          >
            <IconHome size={20} />
          </ActionIcon>
        </Tooltip>

        {/* Chapter Navigation */}
        <Group gap="xs">
          <Tooltip label="Previous Chapter">
            <ActionIcon
              variant="light"
              onClick={() => {
                void prevChapter();
              }}
              disabled={!chapterNavigation?.prevChapter}
              size="lg"
            >
              <IconChevronLeft size={20} />
            </ActionIcon>
          </Tooltip>

          <Menu shadow="md" width={CHAPTER_MENU_WIDTH}>
            <Menu.Target>
              <Button variant="light" size="sm" rightSection={<IconList size={16} />}>
                Ch. {chapterNavigation?.currentChapter?.index ?? '—'}
              </Button>
            </Menu.Target>
            <Menu.Dropdown style={{ maxHeight: CHAPTER_MENU_MAX_HEIGHT, overflowY: 'auto' }}>
              <Menu.Label>
                Jump to Chapter ({chapterNavigation?.totalChapters ?? 0} total)
              </Menu.Label>
              {chapterNavigation?.chapters.map(chapter => (
                <Menu.Item
                  key={chapter.id}
                  onClick={() => {
                    void jumpToChapter(chapter.id);
                  }}
                  style={{
                    backgroundColor:
                      chapter.id === chapterNavigation.currentChapter?.id
                        ? 'var(--mantine-color-blue-light)'
                        : undefined,
                  }}
                >
                  <Group justify="space-between">
                    <Text size="sm">
                      Ch. {chapter.index}: {chapter.title ?? 'Untitled'}
                    </Text>
                    {chapter.pageCount && (
                      <Text size="xs" c="dimmed">
                        {chapter.pageCount} pages
                      </Text>
                    )}
                  </Group>
                </Menu.Item>
              ))}
            </Menu.Dropdown>
          </Menu>

          <Tooltip label="Next Chapter">
            <ActionIcon
              variant="light"
              onClick={() => {
                void nextChapter();
              }}
              disabled={!chapterNavigation?.nextChapter}
              size="lg"
            >
              <IconChevronRight size={20} />
            </ActionIcon>
          </Tooltip>
        </Group>

        <Button
          onClick={prevPage}
          disabled={currentPage === 1}
          size="sm"
          leftSection={<IconArrowLeft size={16} />}
        >
          Previous
        </Button>
      </Group>

      {/* Center section */}
      <Group>
        <Text c="white" fw={500}>
          {file.chapterTitle}
        </Text>
        <Text c="dimmed">
          Page {currentPage} / {totalPages}
        </Text>
        <Progress
          value={(currentPage / totalPages) * 100}
          size="sm"
          style={{
            width: PROGRESS_BAR_WIDTH,
          }}
        />
      </Group>

      {/* Right section */}
      <Group>
        <Button
          onClick={nextPage}
          disabled={currentPage === totalPages}
          size="sm"
          rightSection={<IconArrowRight size={16} />}
        >
          Next
        </Button>

        {/* File Source Toggle - only shown when multiple sources exist */}
        {fileSources && fileSources.length > 1 && onSwitchSource && (
          <Menu shadow="md" width={280}>
            <Menu.Target>
              <Tooltip label="Switch file source">
                <ActionIcon variant="subtle">
                  <IconFile size={20} />
                </ActionIcon>
              </Tooltip>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>File Sources</Menu.Label>
              {fileSources.map((source) => (
                <Menu.Item
                  key={source.id}
                  leftSection={<IconFile size={16} />}
                  onClick={() => onSwitchSource(source.id)}
                  style={{
                    backgroundColor: source.isActive
                      ? 'var(--mantine-color-blue-light)'
                      : undefined,
                  }}
                >
                  <Group justify="space-between">
                    <Text size="sm" lineClamp={1} style={{ maxWidth: 180 }}>
                      {source.fileName}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {source.sourceType === 'chapter' ? 'Chapter' : 'Volume'}
                    </Text>
                  </Group>
                </Menu.Item>
              ))}
            </Menu.Dropdown>
          </Menu>
        )}

        <Tooltip label={isBookmarked ? 'Remove bookmark' : 'Add bookmark'}>
          <ActionIcon
            variant="subtle"
            onClick={toggleBookmark}
            {...(isBookmarked ? { color: 'yellow' } : {})}
          >
            <IconBookmark size={20} />
          </ActionIcon>
        </Tooltip>

        <Tooltip label="Fullscreen">
          <ActionIcon
            variant="subtle"
            onClick={() => {
              void toggleFullscreen();
            }}
          >
            <IconZoomIn size={20} />
          </ActionIcon>
        </Tooltip>

        <Tooltip label="Settings">
          <ActionIcon variant="subtle" onClick={() => setSettingsOpen(true)}>
            <IconSettings size={20} />
          </ActionIcon>
        </Tooltip>
      </Group>
    </Group>
  );
}
