import React from 'react';

import { Badge, Box, Card, Group, Slider, Stack, Text, Title } from '@mantine/core';

interface QualitySettingsCardProps {
  conversionQuality: number;
  compressionLevel: number;
  onQualityChange: (value: number) => void;
  onCompressionChange: (value: number) => void;
}

function qualityLabel(value: number): string {
  if (value === 100) return 'Lossless';
  if (value >= 90) return 'High Quality';
  if (value >= 75) return 'Balanced';
  return 'Small Size';
}

function compressionLabel(value: number): string {
  if (value === 0) return 'No compression';
  if (value <= 3) return 'Fast';
  if (value <= 6) return 'Balanced';
  return 'Maximum';
}

export function QualitySettingsCard({
  conversionQuality,
  compressionLevel,
  onQualityChange,
  onCompressionChange
}: QualitySettingsCardProps): React.ReactElement {
  return (
    <Card shadow="sm" p="lg" radius="md">
      <Title order={4} mb="md">Quality Settings (Manga/Comics)</Title>
      <Stack gap="xl">
        <Box>
          <Text size="sm" fw={500} mb="xs">Image Quality (PDF/EPUB)</Text>
          <Text size="xs" c="dimmed" mb="md">
            Higher values preserve more detail but create larger files
          </Text>
          <Slider
            value={conversionQuality}
            onChange={onQualityChange}
            min={50}
            max={100}
            step={5}
            marks={[{ value: 50, label: '50%' }, { value: 100, label: '100%' }]}
            label={qualityLabel}
            mb="lg"
          />
          <Group justify="space-between" mt="md">
            <Text size="xs" c="dimmed">Smaller file size</Text>
            <Badge size="sm">{conversionQuality}%</Badge>
            <Text size="xs" c="dimmed">Original quality</Text>
          </Group>
        </Box>
        <Box>
          <Text size="sm" fw={500} mb="xs">Compression Level (CBZ)</Text>
          <Text size="xs" c="dimmed" mb="md">
            Higher compression creates smaller files but takes longer to process
          </Text>
          <Slider
            value={compressionLevel}
            onChange={onCompressionChange}
            min={0}
            max={9}
            step={1}
            marks={[{ value: 0, label: '0' }, { value: 9, label: '9' }]}
            label={compressionLabel}
            mb="lg"
          />
          <Group justify="space-between" mt="md">
            <Text size="xs" c="dimmed">Faster (larger files)</Text>
            <Badge size="sm">Level {compressionLevel}</Badge>
            <Text size="xs" c="dimmed">Slower (smaller files)</Text>
          </Group>
        </Box>
      </Stack>
    </Card>
  );
}
