/**
 * MangaDex Download Settings Component
 *
 * Provides settings for MangaDex download configuration.
 * Used on the Indexers page - includes:
 * - Enable toggle (for downloads)
 * - Data saver mode
 * - Language preference
 *
 * Does NOT include content filtering (metadata-specific).
 *
 * @module components/settings/MangaDexDownloadSettings
 */
import React, { useEffect, useState } from 'react';

import {
  Alert,
  Box,
  Button,
  Divider,
  Group,
  LoadingOverlay,
  Select,
  Stack,
  Text
} from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';

import { notify } from '@/utils/notify';
import { trpc } from '@/utils/trpc-client';

import classes from './integration.module.css';
import { MANGADEX_LANGUAGE_OPTIONS } from './mangadex/language-options';
import { SettingsSwitch } from './SettingsSwitch';

interface MangaDexDownloadConfig {
  enabled: boolean;
  preferredLanguage: string;
  dataSaverMode: boolean;
}

const DEFAULT_CONFIG: MangaDexDownloadConfig = {
  enabled: true,
  preferredLanguage: 'en',
  dataSaverMode: false
};

/**
 * MangaDex download settings component for the indexers page.
 * Includes enable toggle and dataSaverMode. Does NOT include content filtering.
 */
export function MangaDexDownloadSettings(): React.ReactElement {
  const [config, setConfig] = useState<MangaDexDownloadConfig>(DEFAULT_CONFIG);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Fetch current download-side config
  const { data: configData, isLoading, refetch } = trpc.nativeDownload.getDownloadConfig.useQuery();

  // Update download-side config mutation
  const updateConfig = trpc.nativeDownload.updateDownloadConfig.useMutation({
    onSuccess: () => {
      setSaveError(null);
      notify({ severity: 'SUCCESS', title: 'Settings Saved', message: 'MangaDex download settings have been updated' });
      void refetch();
    },
    onError: (error: { message: string }) => {
      setSaveError(error.message);
      notify({ severity: 'ERROR', title: 'Save Failed', message: error.message });
    },
    onSettled: () => {
      setSaving(false);
    }
  });

  // Load config data
  useEffect(() => {
    if (configData) {
      setConfig({
        enabled: configData.enabled,
        preferredLanguage: configData.preferredLanguage,
        dataSaverMode: configData.dataSaverMode
      });
    }
  }, [configData]);

  const handleSave = (): void => {
    setSaving(true);
    setSaveError(null);
    updateConfig.mutate({
      enabled: config.enabled,
      preferredLanguage: config.preferredLanguage,
      dataSaverMode: config.dataSaverMode
    });
  };

  const updateSetting = <K extends keyof MangaDexDownloadConfig>(key: K, value: MangaDexDownloadConfig[K]): void => {
    setConfig(prev => ({ ...prev, [key]: value }));
    if (saveError) setSaveError(null);
  };

  return (
    <Stack gap="md" style={{ position: 'relative' }}>
      <LoadingOverlay visible={isLoading || saving} />

      {/* Main toggle */}
      <Box className={classes['item']}>
        <SettingsSwitch
          label="Enable MangaDex Downloads"
          description="Use MangaDex as a source for chapter downloads"
          checked={config.enabled}
          onChange={(event) => updateSetting('enabled', event.currentTarget.checked)}
          disabled={isLoading || saving}
        />
      </Box>

      {config.enabled && (
        <>
          {/* Language preference */}
          <Box className={classes['item']}>
            <Text size="sm" fw={500} mb={4}>Preferred Language</Text>
            <Text size="xs" c="dimmed" mb={8}>
              Default language for chapter downloads. Shared with MangaDex metadata search.
            </Text>
            <Select
              data={[...MANGADEX_LANGUAGE_OPTIONS]}
              value={config.preferredLanguage}
              onChange={(value) => value && updateSetting('preferredLanguage', value)}
              disabled={isLoading || saving}
              searchable
              clearable={false}
            />
          </Box>

          <Divider label="Download Options" labelPosition="center" />

          {/* Data saver mode */}
          <Box className={classes['item']}>
            <SettingsSwitch
              label="Data Saver Mode"
              description="Download compressed images by default (smaller file sizes but lower quality)"
              checked={config.dataSaverMode}
              onChange={(event) => updateSetting('dataSaverMode', event.currentTarget.checked)}
              disabled={isLoading || saving}
            />
          </Box>
        </>
      )}

      {saveError && (
        <Alert
          icon={<IconAlertCircle size="1rem" />}
          color="red"
          variant="light"
          title="Save Failed"
        >
          {saveError}
        </Alert>
      )}

      <Group justify="flex-end" mt="md">
        <Button
          onClick={handleSave}
          loading={saving}
          disabled={isLoading}
        >
          Save Settings
        </Button>
      </Group>
    </Stack>
  );
}
