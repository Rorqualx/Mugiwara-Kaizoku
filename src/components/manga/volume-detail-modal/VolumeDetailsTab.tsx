/**
 * Volume Details Tab Component
 *
 * Displays volume metadata, cover image, and action buttons.
 * Uses unified DownloadButton for consistent download experience.
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
  ScrollArea,
} from '@mantine/core';
import {
  IconExternalLink,
  IconBookmark,
  IconBookmarkOff,
} from '@tabler/icons-react';

import { DownloadButton, UnifiedSearchModal, type DownloadContext } from '@/components/download';
import { sanitizeForReact } from '@/lib/html-sanitizer';

import type { VolumeData } from './volume-detail-modal-types';
import type { Manga as MangaEntity, Chapter as ChapterEntity } from '@prisma/client';

export interface VolumeDetailsTabProps {
  volume: VolumeData;
  mangaTitle?: string | undefined;
  mangaId?: number | undefined;
  /** Full manga entity for download context */
  manga?: MangaEntity;
  isVolumeBookmarked: boolean;
  onToggleBookmark: () => void;
  isBookmarkLoading: boolean;
  /** Callback when download succeeds */
  onDownloadSuccess?: () => void;
}

export function VolumeDetailsTab({
  volume,
  mangaTitle,
  mangaId,
  manga,
  isVolumeBookmarked,
  onToggleBookmark,
  isBookmarkLoading,
  onDownloadSuccess,
}: VolumeDetailsTabProps): JSX.Element {
  const [searchModalOpen, setSearchModalOpen] = useState(false);

  // Build download context for the DownloadButton
  // Use provided manga entity, or construct a minimal one from props
  const downloadContext: DownloadContext | null = mangaId
    ? {
        type: 'volume' as const,
        manga: manga ?? ({
          id: mangaId,
          title: mangaTitle ?? 'Unknown',
          source: 'unknown',
        } as unknown as MangaEntity),
        volumeNumber: volume.volumeNumber,
        chapters: (volume.chapters ?? []) as unknown as ChapterEntity[],
      }
    : null;

  // Transform ComicVine banner crops (screen_kubrick etc.) to full-size originals
  const coverUrl = (volume.coverImage ?? '/cover-not-found.jpg')
    .replace(/\/uploads\/[^/]+\//, '/uploads/original/');

  return (
    <Stack gap="md">
      {/* Volume Header */}
      <Paper p="md" withBorder>
        <Group align="flex-start" wrap="nowrap" gap="md">
          {/* Volume Cover */}
          <Image
            src={coverUrl}
            alt={`Volume ${volume.volumeNumber} cover`}
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

              {/* Volume Title */}
              <Title order={3}>
                {volume.title ?? `Volume ${volume.volumeNumber}`}
              </Title>

              {/* Volume Number and Issue */}
              <Group gap="xs">
                <Badge variant="light" color="blue">
                  Volume {volume.volumeNumber}
                </Badge>
                {volume.issueNumber && (
                  <Badge variant="light" color="grape">
                    Issue #{volume.issueNumber}
                  </Badge>
                )}
                {volume.chapters && (
                  <Badge variant="light" color="teal">
                    {volume.chapters.length} Chapters
                  </Badge>
                )}
              </Group>

              {/* Action Buttons */}
              <Group gap="xs" mt="md">
                {volume.sourceUrl && (
                  <Button
                    component="a"
                    href={volume.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    leftSection={<IconExternalLink size={16} />}
                    variant="light"
                    size="sm"
                  >
                    View on Source
                  </Button>
                )}

                <Button
                  leftSection={isVolumeBookmarked ? <IconBookmark size={16} /> : <IconBookmarkOff size={16} />}
                  variant="light"
                  size="sm"
                  color={isVolumeBookmarked ? 'blue' : 'gray'}
                  onClick={onToggleBookmark}
                  loading={isBookmarkLoading}
                >
                  {isVolumeBookmarked ? 'Bookmarked' : 'Bookmark Volume'}
                </Button>

                {/* Unified Download Button */}
                {downloadContext && (
                  <DownloadButton
                    context={downloadContext}
                    onOpenSearch={() => setSearchModalOpen(true)}
                    onSuccess={onDownloadSuccess}
                    size="sm"
                    variant="filled"
                  />
                )}
              </Group>

              {/* Volume Description */}
              {volume.description && (
                <>
                  <Divider label="Description" labelPosition="center" mt="sm" />
                  <ScrollArea.Autosize mah={400}>
                    <Text
                      size="sm"
                      dangerouslySetInnerHTML={sanitizeForReact(volume.description, { profile: 'RICH' })}
                    />
                  </ScrollArea.Autosize>
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
