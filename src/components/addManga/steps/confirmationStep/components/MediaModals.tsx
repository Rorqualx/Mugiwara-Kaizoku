/**
 * Media Modals Component
 * 
 * Provides modal dialogs for viewing banner images and chapter previews.
 */

import React from 'react';

import {
  Modal,
  Image,
  Stack,
  Text,
  Button,
  Group,
  Box
} from '@mantine/core';

interface BannerModalProps {
  opened: boolean;
  onClose: () => void;
  bannerImage?: string;
  title?: string;
}

export function BannerModal({ opened, onClose, bannerImage, title }: BannerModalProps): React.ReactElement {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={title ? `${title} - Banner` : 'Banner Image'}
      size="xl"
      centered
      overlayProps={{
        backgroundOpacity: 0.7,
        blur: 3,
      }}
      styles={{
        content: { backgroundColor: '#1A1B1E' },
        header: { backgroundColor: '#1A1B1E' },
        title: { color: '#ffffff', fontWeight: 600 },
      }}
    >
      {bannerImage ? (
        <Box>
          <Stack gap="md">
            <Image
              src={bannerImage}
              alt="Banner"
              radius="md"
              fit="contain"
              style={{ maxHeight: '500px' }}
            />
            <Button
              variant="light"
              size="sm"
              mt="sm"
              onClick={() => window.open(bannerImage, '_blank')}
            >
              Open in New Tab
            </Button>
          </Stack>
        </Box>
      ) : (
        <Text c="#999" ta="center">No banner image available</Text>
      )}
    </Modal>
  );
}

interface ChapterPreviewModalProps {
  opened: boolean;
  onClose: () => void;
  chapter?: {
    number: number;
    title: string;
    coverImage?: string;
    releaseDate?: string;
    pageCount?: number;
    scanlator?: string;
    url?: string;
  };
}

export function ChapterPreviewModal({ opened, onClose, chapter }: ChapterPreviewModalProps): React.ReactElement {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={chapter ? `Chapter ${chapter.number}: ${chapter["title"]}` : 'Chapter Preview'}
      size="xl"
      centered
      overlayProps={{
        backgroundOpacity: 0.7,
        blur: 3,
      }}
      styles={{
        content: { backgroundColor: '#1A1B1E' },
        header: { backgroundColor: '#1A1B1E' },
        title: { color: '#ffffff', fontWeight: 600 },
      }}
    >
      {chapter ? (
        <Stack gap="md">
          {chapter.coverImage && (
            <Image
              src={chapter.coverImage}
              alt={`Chapter ${chapter.number} Cover`}
              radius="md"
              fit="contain"
              style={{ maxHeight: '400px' }}
            />
          )}
          
          <Group justify="space-between">
            <Text size="sm" c="#999">Release Date:</Text>
            <Text size="sm" c="#fff">
              {chapter.releaseDate ?? 'Unknown'}
            </Text>
          </Group>
          
          {chapter.pageCount && (
            <Group justify="space-between">
              <Text size="sm" c="#999">Page Count:</Text>
              <Text size="sm" c="#fff">{chapter.pageCount}</Text>
            </Group>
          )}
          
          {chapter.scanlator && (
            <Group justify="space-between">
              <Text size="sm" c="#999">Scanlator:</Text>
              <Text size="sm" c="#fff">{chapter.scanlator}</Text>
            </Group>
          )}
          
          {chapter.url && (
            <Button
              variant="light"
              size="sm"
              onClick={() => window.open(chapter.url, '_blank')}
            >
              View Chapter Online
            </Button>
          )}
        </Stack>
      ) : (
        <Text c="#999" ta="center">No chapter selected</Text>
      )}
    </Modal>
  );
}