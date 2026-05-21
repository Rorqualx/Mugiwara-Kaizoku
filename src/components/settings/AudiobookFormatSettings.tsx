/**
 * Audiobook Format Settings Component
 *
 * Configures support for audiobook formats (MP3, M4A, M4B, AAC, FLAC, ALAC, WAV, OGG).
 * When enabled, allows importing and converting audio files.
 * Requires FFmpeg to be installed on the system.
 *
 * @module components/settings/AudiobookFormatSettings
 */

import React from 'react';

import { Paper, Stack, Text, Title, Alert, Loader, List, Badge, Group } from '@mantine/core';
import { IconMusic, IconAlertCircle, IconAlertTriangle, IconCheck, IconTerminal2 } from '@tabler/icons-react';

import { trpc } from '@/utils/trpc-client';

import { SettingsSwitch } from './SettingsSwitch';
import { useBooleanFormatSetting } from './useBooleanFormatSetting';

/**
 * Renders directly from the tRPC query data (no useState mirror) and uses
 * optimistic cache writes via useBooleanFormatSetting. Adds an FFmpeg
 * availability indicator since audio conversion requires the binary.
 *
 * @component
 */
export function AudiobookFormatSettings(): React.ReactElement | null {
  const { enabled, isLoading, isPending, error, toggle, clearError } = useBooleanFormatSetting(
    'media.enableAudiobooks',
    '[AudiobookFormatSettings]',
    'Audiobook format support updated',
  );

  const { data: ffmpegStatus, isLoading: ffmpegLoading } = trpc.conversion.checkFfmpegStatus.useQuery(
    undefined,
    { staleTime: 60000 }, // 1-minute cache; ffmpeg-availability rarely changes
  );

  if (isLoading) {
    return (
      <Paper p="md" withBorder mb="xl">
        <Stack align="center" justify="center" p="xl">
          <Loader size="lg" />
          <Text size="sm" c="dimmed">Loading audiobook format settings...</Text>
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper p="md" withBorder mb="xl">
      <Stack>
        <Title order={3}>Audiobook Format Support</Title>
        <Text size="sm" c="dimmed" mb="md">
          Configure support for audiobook formats. When enabled, you can import and convert various audio formats.
        </Text>

        {error && (
          <Alert
            icon={<IconAlertCircle size={16} />}
            title="Error"
            color="red"
            withCloseButton
            onClose={clearError}
            mb="md"
          >
            {error}
          </Alert>
        )}

        <SettingsSwitch
          label="Enable Audiobook Formats"
          description="Enable support for audio formats (MP3, M4A, M4B, AAC, FLAC, ALAC, WAV, OGG). Allows importing and converting audio files."
          checked={enabled}
          onChange={toggle}
          disabled={isPending}
        />

        {ffmpegLoading && (
          <Alert
            icon={<Loader size={16} />}
            title="Checking FFmpeg..."
            color="gray"
            variant="light"
            mt="md"
          >
            <Text size="sm">Detecting FFmpeg installation status...</Text>
          </Alert>
        )}

        {!ffmpegLoading && ffmpegStatus?.available === false && (
          <Alert
            icon={<IconAlertTriangle size={16} />}
            title="FFmpeg Not Found"
            color="red"
            variant="light"
            mt="md"
          >
            <Group gap="xs" mb="xs">
              <IconTerminal2 size={16} />
              <Text size="sm" fw={500}>Audio conversion requires FFmpeg</Text>
            </Group>
            <Text size="sm">
              FFmpeg was not detected on your system. Install FFmpeg and ensure it&apos;s available
              in your PATH to enable audiobook format conversion.
            </Text>
          </Alert>
        )}

        {!ffmpegLoading && ffmpegStatus?.available === true && (
          <Alert
            icon={<IconCheck size={16} />}
            title="FFmpeg Ready"
            color="green"
            variant="light"
            mt="md"
          >
            <Group gap="xs" mb="xs">
              <IconTerminal2 size={16} />
              <Text size="sm" fw={500}>Audio conversion is available</Text>
            </Group>
            <Text size="sm">
              FFmpeg is installed and ready. M4B format is recommended for audiobooks
              as it supports chapter markers.
            </Text>
          </Alert>
        )}

        <Alert
          icon={<IconMusic size={16} />}
          title="Supported Formats"
          color="blue"
          variant="light"
          mt="md"
        >
          <Text size="sm" mb="xs">
            When enabled, the following audio formats become available:
          </Text>

          <Group gap="xs" mb="sm">
            <Badge color="green" size="sm">M4B</Badge>
            <Badge color="blue" size="sm">MP3</Badge>
            <Badge color="blue" size="sm">M4A</Badge>
            <Badge color="blue" size="sm">AAC</Badge>
            <Badge color="cyan" size="sm">FLAC</Badge>
            <Badge color="cyan" size="sm">ALAC</Badge>
            <Badge color="cyan" size="sm">WAV</Badge>
            <Badge color="grape" size="sm">OGG</Badge>
          </Group>

          <List size="sm" spacing="xs">
            <List.Item>
              <Text size="sm"><strong>M4B</strong> - Audiobook format with chapter support</Text>
            </List.Item>
            <List.Item>
              <Text size="sm"><strong>MP3, M4A, AAC, OGG</strong> - Lossy compressed audio</Text>
            </List.Item>
            <List.Item>
              <Text size="sm"><strong>FLAC, ALAC, WAV</strong> - Lossless audio formats</Text>
            </List.Item>
          </List>

          <Text size="xs" c="dimmed" mt="sm">
            Convert between any supported format. Chapter metadata is preserved where possible.
          </Text>
        </Alert>

        {isPending && (
          <Alert
            icon={<IconAlertCircle size={16} />}
            title="Saving..."
            color="yellow"
            variant="light"
          >
            Saving setting...
          </Alert>
        )}
      </Stack>
    </Paper>
  );
}
