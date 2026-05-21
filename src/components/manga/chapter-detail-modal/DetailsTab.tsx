/**
 * Chapter Detail Modal - Details Tab
 *
 * Displays chapter information including cover, metadata,
 * and action buttons. Uses unified DownloadButton for consistent
 * download experience.
 *
 * Extracted from: ChapterDetailModal.tsx (lines 556-657)
 */

import React, { useState } from 'react';

import {
  Stack,
  Group,
  Text,
  Image,
  Badge,
  Button,
  Paper,
  Title,
  Divider,
  ActionIcon,
  Tooltip
} from '@mantine/core';
import {
  IconBook,
  IconExternalLink,
  IconFile,
  IconFolder,
  IconTrash
} from '@tabler/icons-react';

import { DownloadButton, UnifiedSearchModal, type DownloadContext } from '@/components/download';

import { getStatusColor, getStatusText } from './utils';

import type { ChapterEntity } from './types';
import type { Manga as MangaEntity, Chapter as ChapterEntityPrisma } from '@prisma/client';

// ============================================================================
// Chapter Badges Component
// ============================================================================

interface ChapterBadgesProps {
  chapter: ChapterEntity;
}

/** Detect if a chapter record is actually a volume file by chapterNumber offset */
function isVolumeFile(chapter: ChapterEntity): boolean {
  return chapter.chapterNumber !== null && chapter.chapterNumber >= 100_000;
}

function ChapterBadges({ chapter }: ChapterBadgesProps): JSX.Element {
  const mangadexId = (chapter as unknown as { mangadexId?: string | null }).mangadexId;
  const volumeFile = isVolumeFile(chapter);

  return (
    <Group gap="xs">
      {volumeFile ? (
        <Badge variant="light" color="violet">
          Volume File
        </Badge>
      ) : (
        <Badge variant="light" color="blue">
          Chapter {chapter.index}
        </Badge>
      )}
      {chapter.volume !== null && (
        <Badge variant="light" color="grape">
          Volume {chapter.volume}
        </Badge>
      )}
      {chapter.pageCount !== null && chapter.pageCount > 0 && (
        <Badge variant="light" color="gray" leftSection={<IconFile size={12} />}>
          {chapter.pageCount} pages
        </Badge>
      )}
      <Badge color={getStatusColor(chapter)}>
        {getStatusText(chapter)}
      </Badge>
      {mangadexId && (
        <Badge variant="light" color="orange">
          MangaDex
        </Badge>
      )}
    </Group>
  );
}

// ============================================================================
// File Path Actions Component
// ============================================================================

interface FilePathActionsProps {
  filePath: string;
  chapterId: number;
  onOpenFolder?: ((filePath: string) => void) | undefined;
  onDelete?: ((chapterId: number) => void) | undefined;
}

function FilePathActions({
  filePath,
  chapterId,
  onOpenFolder,
  onDelete
}: FilePathActionsProps): JSX.Element {
  return (
    <Group gap="xs" justify="space-between" w="100%">
      <Tooltip label={filePath} multiline maw={400}>
        <Group gap={4} style={{ flex: 1, minWidth: 0 }}>
          <IconFolder size={14} style={{ flexShrink: 0 }} />
          <Text size="xs" c="dimmed" truncate style={{ flex: 1 }}>
            {filePath}
          </Text>
        </Group>
      </Tooltip>

      <Group gap={4}>
        {onOpenFolder && (
          <ActionIcon
            variant="subtle"
            size="sm"
            title="Open folder"
            onClick={() => onOpenFolder(filePath)}
          >
            <IconFolder size={14} />
          </ActionIcon>
        )}
        {onDelete && (
          <ActionIcon
            variant="subtle"
            size="sm"
            color="red"
            title="Delete chapter"
            onClick={() => onDelete(chapterId)}
          >
            <IconTrash size={14} />
          </ActionIcon>
        )}
      </Group>
    </Group>
  );
}

// ============================================================================
// Details Tab Component
// ============================================================================

interface DetailsTabProps {
  chapter: ChapterEntity;
  mangaTitle?: string;
  mangaId?: number;
  onDownload?: (chapterId: number) => void;
  onRead?: (chapterId: number) => void;
  onDownloadSuccess?: () => void;
  onDelete?: (chapterId: number) => void;
  onOpenFolder?: (filePath: string) => void;
}

// eslint-disable-next-line complexity -- UI component with multiple conditional badge/section renders
export function DetailsTab({
  chapter,
  mangaTitle,
  mangaId,
  onDownload,
  onRead,
  onDownloadSuccess,
  onDelete,
  onOpenFolder
}: DetailsTabProps): JSX.Element {
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const volumeFile = isVolumeFile(chapter);

  // Build download context for the DownloadButton
  const downloadContext: DownloadContext | null = mangaId
    ? {
        type: 'chapter' as const,
        manga: {
          id: mangaId,
          title: mangaTitle ?? 'Unknown',
          source: 'unknown',
        } as unknown as MangaEntity,
        chapter: chapter as unknown as ChapterEntityPrisma,
      }
    : null;

  // Transform ComicVine banner crops (screen_kubrick etc.) to full-size originals
  const coverUrl = (chapter.coverImage ?? chapter.downloadUrl ?? '/cover-not-found.jpg')
    .replace(/\/uploads\/[^/]+\//, '/uploads/original/');

  return (
    <Stack gap="md">
      {/* Chapter Header */}
      <Paper p="md" withBorder>
        <Group align="flex-start" wrap="nowrap" gap="md">
          {/* Chapter Cover */}
          <Image
            src={coverUrl}
            alt={volumeFile ? `Volume ${chapter.volume} file` : `Chapter ${chapter.index} cover`}
            radius="md"
            fallbackSrc="/cover-not-found.jpg"
            style={{ flexShrink: 0, maxWidth: 400, maxHeight: '65vh', width: 'auto', height: 'auto' }}
          />

          <div style={{ flex: 1 }}>
            <Stack gap="sm">
              {/* Manga Title */}
              {mangaTitle && (
                <Text size="sm" c="dimmed">{mangaTitle}</Text>
              )}

              {/* Chapter/Volume Title */}
              <Title order={3}>
                {volumeFile
                  ? `Vol. ${chapter.volume ?? chapter.index} — ${chapter.fileName}`
                  : (chapter.title || `Chapter ${chapter.index}`)}
              </Title>

              {/* Chapter Number, Page Count, and Status */}
              <ChapterBadges chapter={chapter} />

              {/* File Path with actions */}
              {chapter.filePath !== null && (
                <FilePathActions
                  filePath={chapter.filePath}
                  chapterId={chapter.id}
                  onOpenFolder={onOpenFolder}
                  onDelete={onDelete}
                />
              )}

              {/* Action Buttons */}
              <Group gap="xs" mt="md">
                {/* Unified Download Button */}
                {downloadContext && chapter.downloadStatus !== 'COMPLETED' && (
                  <DownloadButton
                    context={downloadContext}
                    onOpenSearch={() => setSearchModalOpen(true)}
                    onSuccess={onDownloadSuccess}
                    size="sm"
                    variant="filled"
                  />
                )}

                {/* Legacy download handler fallback */}
                {!downloadContext && chapter.downloadStatus !== 'COMPLETED' && onDownload && (
                  <Button
                    leftSection={<IconBook size={16} />}
                    onClick={() => onDownload(chapter.id)}
                    variant="filled"
                    size="sm"
                  >
                    Download
                  </Button>
                )}

                {chapter.downloadStatus === 'COMPLETED' && onRead && (
                  <Button
                    leftSection={<IconBook size={16} />}
                    onClick={() => onRead(chapter.id)}
                    variant="light"
                    size="sm"
                  >
                    Read
                  </Button>
                )}

                {chapter.downloadUrl && (
                  <ActionIcon
                    component="a"
                    href={chapter.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="light"
                    size="lg"
                    title="View on source"
                  >
                    <IconExternalLink size={16} />
                  </ActionIcon>
                )}
              </Group>

              {/* Chapter Description */}
              {chapter.description ? (
                <>
                  <Divider label="Description" labelPosition="center" mt="sm" />
                  <Text size="sm" lineClamp={8}>{chapter.description}</Text>
                </>
              ) : (
                <>
                  <Divider label="Description" labelPosition="center" mt="sm" />
                  <Text size="sm" c="dimmed" fs="italic">
                    No description available from this source
                  </Text>
                </>
              )}
            </Stack>
          </div>
        </Group>
      </Paper>

      {/* Unified Search Modal */}
      {downloadContext && (
        <UnifiedSearchModal
          opened={searchModalOpen}
          onClose={() => setSearchModalOpen(false)}
          context={downloadContext}
          onSuccess={onDownloadSuccess}
        />
      )}
    </Stack>
  );
}
