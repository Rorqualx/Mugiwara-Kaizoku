import React from 'react';

import { Badge, Box, Card, Group, Select, Slider, Stack, Text, Title } from '@mantine/core';
import { IconBook } from '@tabler/icons-react';

import { ebookFormatOptions, formatIcon } from './helpers';

import type { UseFormReturnType } from '@mantine/form';

type FormInputProps = ReturnType<UseFormReturnType<Record<string, unknown>>['getInputProps']>;

interface EbookFormatCardProps {
  selectedFormat: string;
  ebookQuality: number;
  formatInputProps: FormInputProps;
  onQualityChange: (value: number) => void;
}

function qualityLabel(value: number): string {
  if (value === 100) return 'Lossless';
  if (value >= 90) return 'High Quality';
  if (value >= 75) return 'Balanced';
  return 'Small Size';
}

export function EbookFormatCard({
  selectedFormat,
  ebookQuality,
  formatInputProps,
  onQualityChange
}: EbookFormatCardProps): React.ReactElement {
  return (
    <Card shadow="sm" p="lg" radius="md">
      <Group mb="md">
        <IconBook size={24} />
        <Title order={4}>Ebook Format</Title>
        <Badge color="green" variant="light">Enabled</Badge>
      </Group>
      <Stack gap="md">
        <Select
          label="Default Ebook Output Format"
          description="MOBI and AZW3 files will be converted to this format"
          placeholder="Select ebook format"
          data={ebookFormatOptions}
          leftSection={formatIcon(selectedFormat)}
          {...formatInputProps}
        />
        <Box>
          <Text size="sm" fw={500} mb="xs">Image Quality</Text>
          <Text size="xs" c="dimmed" mb="md">
            Higher values preserve more detail but create larger files
          </Text>
          <Slider
            value={ebookQuality}
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
            <Badge size="sm">{ebookQuality}%</Badge>
            <Text size="xs" c="dimmed">Original quality</Text>
          </Group>
        </Box>
      </Stack>
    </Card>
  );
}
