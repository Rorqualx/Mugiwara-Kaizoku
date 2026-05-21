/**
 * Volume & Chapter Preview Tab
 *
 * Displays scraped volume/chapter data from Fandom and ComicVine providers.
 * Lazy-loaded — only fetches when user clicks "Load Preview".
 */

import React, { memo, useCallback } from 'react';

import {
  Stack,
  Group,
  Text,
  Badge,
  Button,
  Alert,
  Accordion,
  LoadingOverlay,
  Paper,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconBook,
  IconDownload,
  IconFileText,
} from '@tabler/icons-react';

import { useVolumeChapterPreview } from './useVolumeChapterPreview';
import { getProviderColor, formatProviderLabel } from './utils';

import type { ProviderBindings, ProviderVolumePreview, VolumePreviewItem } from './types';

interface VolumeChapterPreviewTabProps {
  providerData: Record<string, unknown>;
  providerBindings?: ProviderBindings | undefined;
}

/** Single volume accordion item showing chapter list */
const VolumeAccordionItem = memo(function VolumeAccordionItem({
  volume,
}: {
  volume: VolumePreviewItem;
}): React.ReactElement {
  const label = volume.title
    ? `Vol. ${volume.volumeNumber} — ${volume.title}`
    : `Volume ${volume.volumeNumber}`;

  return (
    <Accordion.Item value={`vol-${volume.volumeNumber}`}>
      <Accordion.Control>
        <Group justify="space-between">
          <Group gap="xs">
            <IconBook size={16} />
            <Text size="sm" fw={500}>{label}</Text>
          </Group>
          <Badge size="xs" variant="outline" color="gray">
            {volume.chapters.length} ch
          </Badge>
        </Group>
      </Accordion.Control>
      <Accordion.Panel>
        {volume.chapters.length === 0 ? (
          <Text size="xs" c="dimmed" ta="center">No chapters found</Text>
        ) : (
          <Stack gap={4}>
            {volume.chapters.map((ch, idx) => (
              <Group key={`${ch.number}-${idx}`} gap="xs">
                <IconFileText size={12} style={{ opacity: 0.5 }} />
                <Text size="xs" c="dimmed">#{ch.number}</Text>
                {ch.title ? <Text size="xs">{ch.title}</Text> : null}
              </Group>
            ))}
          </Stack>
        )}
      </Accordion.Panel>
    </Accordion.Item>
  );
});

/** Provider section showing its volumes in an accordion */
const ProviderSection = memo(function ProviderSection({
  preview,
}: {
  preview: ProviderVolumePreview;
}): React.ReactElement {
  if (preview.error) {
    return (
      <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light" title={formatProviderLabel(preview.provider)}>
        {preview.error}
      </Alert>
    );
  }

  if (preview.volumes.length === 0) {
    return (
      <Paper p="sm" withBorder>
        <Group gap="xs">
          <Badge color={getProviderColor(preview.provider)} variant="filled" size="sm">
            {formatProviderLabel(preview.provider)}
          </Badge>
          <Text size="sm" c="dimmed">No volumes found</Text>
        </Group>
      </Paper>
    );
  }

  return (
    <Stack gap="xs">
      <Group gap="xs">
        <Badge color={getProviderColor(preview.provider)} variant="filled" size="sm">
          {formatProviderLabel(preview.provider)}
        </Badge>
        <Text size="xs" c="dimmed">
          {preview.volumes.length} volumes, {preview.totalChapters} chapters
        </Text>
      </Group>

      <Accordion variant="contained" chevronPosition="left">
        {preview.volumes.map((vol) => (
          <VolumeAccordionItem key={vol.volumeNumber} volume={vol} />
        ))}
      </Accordion>
    </Stack>
  );
});

/** Empty state shown before loading */
const PreviewEmptyState = memo(function PreviewEmptyState({
  onLoad,
}: {
  onLoad: () => void;
}): React.ReactElement {
  return (
    <Stack gap="md" align="center" py="xl">
      <Text size="sm" c="dimmed" ta="center">
        Scraping volume/chapter data can take a moment.
      </Text>
      <Button leftSection={<IconDownload size={16} />} onClick={onLoad} variant="light">
        Load Volume & Chapter Preview
      </Button>
    </Stack>
  );
});

/** Loaded state with results and refresh button */
const PreviewResults = memo(function PreviewResults({
  previews,
  isLoading,
  error,
  onRefresh,
}: {
  previews: ProviderVolumePreview[];
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
}): React.ReactElement {
  return (
    <Stack gap="md" pos="relative" mih={200}>
      <LoadingOverlay visible={isLoading} />

      {error ? (
        <Alert icon={<IconAlertCircle size={16} />} color="yellow" variant="light">
          {error}
        </Alert>
      ) : null}

      {previews.map((preview) => (
        <ProviderSection key={preview.provider} preview={preview} />
      ))}

      {previews.length > 0 ? (
        <Button size="xs" variant="subtle" onClick={onRefresh} loading={isLoading}>
          Refresh
        </Button>
      ) : null}
    </Stack>
  );
});

export const VolumeChapterPreviewTab = memo(function VolumeChapterPreviewTab({
  providerData,
  providerBindings,
}: VolumeChapterPreviewTabProps): React.ReactElement {
  const { previews, isLoading, error, loadPreview } = useVolumeChapterPreview({
    providerData,
    providerBindings,
  });

  const handleLoad = useCallback((): void => {
    void loadPreview();
  }, [loadPreview]);

  const hasResults = previews.length > 0 || isLoading || error !== null;

  if (!hasResults) {
    return <PreviewEmptyState onLoad={handleLoad} />;
  }

  return (
    <PreviewResults
      previews={previews}
      isLoading={isLoading}
      error={error}
      onRefresh={handleLoad}
    />
  );
});
