import React from 'react';

import { Alert, Badge, Box, Card, Group, Select, Slider, Stack, Text, Title } from '@mantine/core';
import { IconAlertCircle, IconCheck, IconInfoCircle, IconMusic, IconTerminal2 } from '@tabler/icons-react';

import { audiobookFormatOptions, formatIcon } from './helpers';

import type { UseFormReturnType } from '@mantine/form';

type FormInputProps = ReturnType<UseFormReturnType<Record<string, unknown>>['getInputProps']>;

interface FfmpegStatus {
  available: boolean;
  error: string | null;
}

interface AudiobookFormatCardProps {
  selectedFormat: string;
  audioBitrate: number;
  formatInputProps: FormInputProps;
  onBitrateChange: (value: number) => void;
  ffmpegStatus: FfmpegStatus | undefined;
}

 
export function AudiobookFormatCard({
  selectedFormat,
  audioBitrate,
  formatInputProps,
  onBitrateChange,
  ffmpegStatus
}: AudiobookFormatCardProps): React.ReactElement {
  return (
    <Card shadow="sm" p="lg" radius="md">
      <Group mb="md">
        <IconMusic size={24} />
        <Title order={4}>Audiobook Format</Title>
        <Badge color="green" variant="light">Enabled</Badge>
      </Group>

      <Stack gap="md">
        <Select
          label="Default Audiobook Output Format"
          description="Audio files will be converted to this format"
          placeholder="Select audio format"
          data={audiobookFormatOptions}
          leftSection={formatIcon(selectedFormat)}
          {...formatInputProps}
        />

        <Box>
          <Text size="sm" fw={500} mb="xs">Audio Bitrate (kbps)</Text>
          <Text size="xs" c="dimmed" mb="md">
            Higher bitrate means better quality but larger files. 192kbps is CD-quality.
          </Text>
          <Slider
            value={audioBitrate}
            onChange={onBitrateChange}
            min={64}
            max={320}
            step={32}
            marks={[
              { value: 64, label: '64' },
              { value: 320, label: '320' }
            ]}
            label={(value) => {
              if (value >= 256) return 'Studio Quality';
              if (value >= 192) return 'CD Quality';
              if (value >= 128) return 'Good';
              return 'Compact';
            }}
            mb="lg"
          />
          <Group justify="space-between" mt="md">
            <Text size="xs" c="dimmed">Smaller file size</Text>
            <Badge size="sm">{audioBitrate} kbps</Badge>
            <Text size="xs" c="dimmed">Studio quality</Text>
          </Group>
        </Box>

        <Alert icon={<IconInfoCircle size={16} />} color="yellow" variant="light">
          <Text size="sm">
            <strong>Note:</strong> Converting to lossless formats (FLAC, ALAC, WAV) ignores the bitrate setting
            and preserves original quality. Converting from lossless to lossy will use this bitrate.
          </Text>
        </Alert>

        {ffmpegStatus?.available === false && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
            <Group gap="xs">
              <IconTerminal2 size={16} />
              <Text size="sm" fw={500}>FFmpeg Not Found</Text>
            </Group>
            <Text size="sm" mt="xs">
              Audio conversion requires FFmpeg to be installed. Install FFmpeg on your system
              to enable audiobook format conversion.
            </Text>
          </Alert>
        )}

        {ffmpegStatus?.available === true && (
          <Alert icon={<IconCheck size={16} />} color="green" variant="light">
            <Group gap="xs">
              <IconTerminal2 size={16} />
              <Text size="sm" fw={500}>FFmpeg Available</Text>
            </Group>
            <Text size="sm" mt="xs">
              Audio conversion is ready. M4B format is recommended for audiobooks as it supports chapters.
            </Text>
          </Alert>
        )}
      </Stack>
    </Card>
  );
}
