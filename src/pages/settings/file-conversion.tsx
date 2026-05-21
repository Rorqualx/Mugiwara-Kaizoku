/**
 * File Conversion Settings Page
 *
 * Allows users to configure automatic file format conversion preferences.
 * Integrated with the FileImporter to automatically convert downloaded files
 * to the user's preferred format.
 */

import React, { useEffect } from 'react';
import type { ReactElement } from 'react';

import { Button, Card, Container, Group, Stack, Switch, Text, Title } from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import { IconAlertCircle, IconCheck } from '@tabler/icons-react';

import { ResponsiveMainLayout } from '@/components/layouts/ResponsiveMainLayout';
import SettingsLayout from '@/components/layouts/SettingsLayout';
import { AudiobookFormatCard } from '@/components/settings/file-conversion/AudiobookFormatCard';
import { DefaultFormatCard } from '@/components/settings/file-conversion/DefaultFormatCard';
import { EbookFormatCard } from '@/components/settings/file-conversion/EbookFormatCard';
import { QualitySettingsCard } from '@/components/settings/file-conversion/QualitySettingsCard';
import { StatisticsCard } from '@/components/settings/file-conversion/StatisticsCard';
import type { ConversionSettingsValues } from '@/components/settings/file-conversion/types';
import { useConversionSettings } from '@/components/settings/file-conversion/useConversionSettings';
import { useRealTime } from '@/providers/RealTimeProvider';
import type { AsyncResult } from '@/utils/async-result';
import { trpc } from '@/utils/trpc-client/index';

// settings.get returns AsyncResult<unknown, Error>; "true" comes back as either
// the string literal (legacy KV rows) or the boolean (newer JSON-typed rows).
function parseEnabledFlag(result: AsyncResult<unknown, Error> | undefined): boolean {
  if (result?.status !== 'success') return false;
  return result.data === 'true' || result.data === true;
}

function FileConversionSettings(): React.ReactElement {
  const { isConnected, subscribe } = useRealTime();

  const { data: formatsData } = trpc.conversion.getSupportedFormats.useQuery();
  const { data: statsData, refetch: refetchStats } = trpc.conversion.getStatistics.useQuery(
    undefined,
    { refetchInterval: isConnected ? false : 5000 }
  );

  useEffect(() => {
    if (!isConnected) return;
    const unsubscribe = subscribe('jobs:conversion', () => { void refetchStats(); });
    return unsubscribe;
  }, [isConnected, subscribe, refetchStats]);

  const { data: ebookEnabledData } = trpc.settings.get.useQuery(
    { key: 'media.enableEbookFormats' },
    { refetchOnMount: true, refetchOnWindowFocus: false }
  );
  const { data: audiobookEnabledData } = trpc.settings.get.useQuery(
    { key: 'media.enableAudiobooks' },
    { refetchOnMount: true, refetchOnWindowFocus: false }
  );
  const { data: ffmpegStatus, isLoading: ffmpegLoading } = trpc.conversion.checkFfmpegStatus.useQuery(
    undefined,
    { refetchOnMount: true, staleTime: 60000 }
  );

  const ebookEnabled = React.useMemo(() => parseEnabledFlag(ebookEnabledData), [ebookEnabledData]);
  const audiobookEnabled = React.useMemo(() => parseEnabledFlag(audiobookEnabledData), [audiobookEnabledData]);

  const { form, configLoading, saveAll, isPending } = useConversionSettings();

  const handleSubmit = async (values: ConversionSettingsValues): Promise<void> => {
    const { failed, total } = await saveAll(values);
    if (failed === 0) {
      showNotification({
        title: 'Settings Updated',
        message: 'File conversion settings have been saved',
        color: 'green',
        icon: <IconCheck />
      });
      void refetchStats();
    } else {
      showNotification({
        title: 'Error',
        message: `Failed to save ${failed} of ${total} settings`,
        color: 'red',
        icon: <IconAlertCircle />
      });
    }
  };

  const formatOptions = formatsData?.targetFormats?.map((format: string) => ({
    value: format,
    label: format.toUpperCase()
  })) ?? [
    { value: 'cbz', label: 'CBZ' },
    { value: 'pdf', label: 'PDF' },
    { value: 'epub', label: 'EPUB' }
  ];

  return (
    <SettingsLayout title="File Conversion">
      <Container size="xl" px={0}>
        {configLoading ? (
          <Text>Loading...</Text>
        ) : (
          <form onSubmit={form.onSubmit(handleSubmit)}>
            <Stack gap="lg">
              {statsData && <StatisticsCard statsData={statsData} />}

              <DefaultFormatCard
                formatOptions={formatOptions}
                selectedFormat={form.values.defaultFormat}
                inputProps={form.getInputProps('defaultFormat')}
                ebookEnabled={ebookEnabled}
                audiobookEnabled={audiobookEnabled}
                ffmpegStatus={ffmpegStatus}
                ffmpegLoading={ffmpegLoading}
              />

              {ebookEnabled && (
                <EbookFormatCard
                  selectedFormat={form.values.defaultEbookFormat}
                  ebookQuality={form.values.ebookQuality}
                  formatInputProps={form.getInputProps('defaultEbookFormat')}
                  onQualityChange={(value) => form.setFieldValue('ebookQuality', value)}
                />
              )}

              {audiobookEnabled && (
                <AudiobookFormatCard
                  selectedFormat={form.values.defaultAudiobookFormat}
                  audioBitrate={form.values.audioBitrate}
                  formatInputProps={form.getInputProps('defaultAudiobookFormat')}
                  onBitrateChange={(value) => form.setFieldValue('audioBitrate', value)}
                  ffmpegStatus={ffmpegStatus}
                />
              )}

              <Card shadow="sm" p="lg" radius="md">
                <Title order={4} mb="md">Conversion Options</Title>
                <Stack gap="md">
                  <Switch
                    label="Enable Automatic Conversion"
                    description="Automatically convert downloaded and pack-imported files to the preferred format"
                    checked={form.values.enableAutoConversion}
                    onChange={(event): void => {
                      const next = event.currentTarget.checked;
                      form.setFieldValue('enableAutoConversion', next);
                      // Auto-save isolated toggles so the user doesn't have
                      // to remember to scroll down and click Save Settings.
                      void handleSubmit({ ...form.values, enableAutoConversion: next });
                    }}
                  />
                  <Switch
                    label="Delete Source After Conversion"
                    description="Remove original file after successful conversion (saves disk space)"
                    checked={form.values.deleteSourceAfterConversion}
                    onChange={(event): void => {
                      const next = event.currentTarget.checked;
                      form.setFieldValue('deleteSourceAfterConversion', next);
                      void handleSubmit({ ...form.values, deleteSourceAfterConversion: next });
                    }}
                  />
                </Stack>
              </Card>

              <QualitySettingsCard
                conversionQuality={form.values.conversionQuality}
                compressionLevel={form.values.compressionLevel}
                onQualityChange={(value) => form.setFieldValue('conversionQuality', value)}
                onCompressionChange={(value) => form.setFieldValue('compressionLevel', value)}
              />

              <Group justify="flex-end">
                <Button variant="default" onClick={() => form.reset()} disabled={isPending}>
                  Reset
                </Button>
                <Button type="submit" loading={isPending} leftSection={<IconCheck />}>
                  Save Settings
                </Button>
              </Group>
            </Stack>
          </form>
        )}
      </Container>
    </SettingsLayout>
  );
}

export default FileConversionSettings;

FileConversionSettings.getLayout = function getLayout(page: ReactElement): React.ReactElement {
  return <ResponsiveMainLayout>{page}</ResponsiveMainLayout>;
};
