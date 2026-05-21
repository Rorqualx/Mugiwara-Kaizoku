import React from 'react';

import { Alert, Badge, Card, Divider, Group, Select, Stack, Text, Title } from '@mantine/core';
import {
  IconBook,
  IconFile,
  IconInfoCircle,
  IconMusic,
  IconTerminal2
} from '@tabler/icons-react';

import { formatIcon } from './helpers';

import type { UseFormReturnType } from '@mantine/form';

type FormInputProps = ReturnType<UseFormReturnType<Record<string, unknown>>['getInputProps']>;

interface SelectOption {
  value: string;
  label: string;
}

interface FfmpegStatus {
  available: boolean;
  error: string | null;
}

interface DefaultFormatCardProps {
  formatOptions: SelectOption[];
  selectedFormat: string;
  inputProps: FormInputProps;
  ebookEnabled: boolean;
  audiobookEnabled: boolean;
  ffmpegStatus: FfmpegStatus | undefined;
  ffmpegLoading: boolean;
}

function FormatSection({
  label,
  enabled,
  icon,
  color,
  formats,
}: {
  label: string;
  enabled: boolean;
  icon: React.ReactNode;
  color: string;
  formats: readonly string[];
}): React.ReactElement {
  const variant = enabled ? 'outline' : 'default';
  const badgeColor = enabled ? color : 'gray';
  return (
    <>
      <Group gap="xs" mb="xs">
        <Text size="xs" fw={500} c={enabled ? 'inherit' : 'dimmed'}>{label}</Text>
        <Badge size="xs" color={enabled ? 'green' : 'gray'}>
          {enabled ? 'Enabled' : 'Disabled'}
        </Badge>
      </Group>
      <Group gap="xs" mb="sm">
        {formats.map(name => (
          <Badge key={name} leftSection={icon} variant={variant} size="lg" color={badgeColor}>{name}</Badge>
        ))}
      </Group>
    </>
  );
}

function FfmpegStatusBadge({ status, loading }: { status: FfmpegStatus | undefined; loading: boolean }): React.ReactElement {
  const color = loading ? 'gray' : (status?.available ? 'green' : 'red');
  const text = loading ? 'Checking...' : (status?.available ? 'Available' : 'Not Found');
  return (
    <Badge size="xs" color={color} leftSection={<IconTerminal2 size={12} />}>
      FFmpeg: {text}
    </Badge>
  );
}

export function DefaultFormatCard({
  formatOptions,
  selectedFormat,
  inputProps,
  ebookEnabled,
  audiobookEnabled,
  ffmpegStatus,
  ffmpegLoading
}: DefaultFormatCardProps): React.ReactElement {
  return (
    <Card shadow="sm" p="lg" radius="md">
      <Title order={4} mb="md">Default Format</Title>

      <Stack gap="md">
        <Select
          label="Preferred File Format"
          description="Downloaded files will be automatically converted to this format"
          placeholder="Select format"
          data={formatOptions}
          leftSection={formatIcon(selectedFormat)}
          {...inputProps}
        />

        <Alert icon={<IconInfoCircle />} color="blue" variant="light">
          <Text size="sm">
            Files will be converted in the background after import. The original file
            can optionally be deleted after successful conversion.
          </Text>
        </Alert>

        <Divider />

        <div>
          <Text size="sm" fw={500} mb="xs">Supported Input Formats:</Text>
          <Text size="xs" c="dimmed" mb="xs">Files in these formats can be converted</Text>
          <Group gap="xs" mb="sm">
            <Badge leftSection={<IconFile size={16} />} variant="outline" size="lg">CBZ</Badge>
            <Badge leftSection={<IconFile size={16} />} variant="outline" size="lg">CBR</Badge>
            <Badge leftSection={<IconFile size={16} />} variant="outline" size="lg">ZIP</Badge>
            <Badge leftSection={<IconFile size={16} />} variant="outline" size="lg">PDF</Badge>
            <Badge leftSection={<IconBook size={16} />} variant="outline" size="lg">EPUB</Badge>
          </Group>

          <FormatSection
            label="Ebook Formats"
            enabled={ebookEnabled}
            icon={<IconBook size={16} />}
            color="grape"
            formats={['MOBI', 'AZW3']}
          />

          <Group gap="xs" mb="xs">
            <Text size="xs" fw={500} c={audiobookEnabled ? 'inherit' : 'dimmed'}>Audiobook Formats</Text>
            <Badge size="xs" color={audiobookEnabled ? 'green' : 'gray'}>
              {audiobookEnabled ? 'Enabled' : 'Disabled'}
            </Badge>
            {audiobookEnabled && <FfmpegStatusBadge status={ffmpegStatus} loading={ffmpegLoading} />}
          </Group>
          <Group gap="xs" mb="md">
            {(['MP3', 'M4A', 'M4B', 'FLAC', 'OGG'] as const).map(name => (
              <Badge
                key={name}
                leftSection={<IconMusic size={16} />}
                variant={audiobookEnabled ? 'outline' : 'default'}
                size="lg"
                color={audiobookEnabled ? 'teal' : 'gray'}
              >
                {name}
              </Badge>
            ))}
          </Group>

          <Divider my="sm" />

          <Text size="sm" fw={500} mb="xs">Supported Output Formats:</Text>
          <Text size="xs" c="dimmed" mb="xs">Files can be converted to these formats</Text>
          <Group gap="xs" mb="sm">
            <Badge leftSection={<IconFile size={16} />} variant="light" size="lg">CBZ</Badge>
            <Badge leftSection={<IconFile size={16} />} variant="light" size="lg">PDF</Badge>
            <Badge leftSection={<IconBook size={16} />} variant="light" size="lg">EPUB</Badge>
          </Group>

          {audiobookEnabled && (
            <>
              <Text size="xs" fw={500} mb="xs">Audiobook Output Formats</Text>
              <Group gap="xs">
                <Badge leftSection={<IconMusic size={16} />} variant="light" size="lg" color="teal">MP3</Badge>
                <Badge leftSection={<IconMusic size={16} />} variant="light" size="lg" color="teal">M4A</Badge>
                <Badge leftSection={<IconMusic size={16} />} variant="light" size="lg" color="teal">M4B</Badge>
                <Badge leftSection={<IconMusic size={16} />} variant="light" size="lg" color="teal">FLAC</Badge>
                <Badge leftSection={<IconMusic size={16} />} variant="light" size="lg" color="teal">OGG</Badge>
              </Group>
            </>
          )}
        </div>
      </Stack>
    </Card>
  );
}
