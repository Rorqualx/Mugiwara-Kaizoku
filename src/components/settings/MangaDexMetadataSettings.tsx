/**
 * MangaDex Metadata Settings Component
 *
 * Provides settings for MangaDex metadata search configuration.
 * Used on the Metadata Providers page - does NOT include:
 * - Enable toggle (handled by parent MetadataProviderCard)
 * - Data saver mode (download-specific)
 *
 * @module components/settings/MangaDexMetadataSettings
 */
import React, { useEffect, useState } from 'react';

import {
  Alert,
  Box,
  Button,
  Divider,
  Group,
  LoadingOverlay,
  MultiSelect,
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

// Content rating options
const CONTENT_RATINGS = [
  { value: 'safe', label: 'Safe' },
  { value: 'suggestive', label: 'Suggestive' },
  { value: 'erotica', label: 'Erotica' },
  { value: 'pornographic', label: 'Pornographic' }
];

interface MangaDexMetadataConfig {
  preferredLanguage: string;
  includeAdult: boolean;
  defaultContentRating: string[];
}

const DEFAULT_CONFIG: MangaDexMetadataConfig = {
  preferredLanguage: 'en',
  includeAdult: false,
  defaultContentRating: ['safe', 'suggestive']
};

/**
 * MangaDex metadata settings component for the metadata providers page.
 * Does NOT include enable toggle (parent handles) or dataSaverMode (downloads-only).
 */
export function MangaDexMetadataSettings(): React.ReactElement {
  const [config, setConfig] = useState<MangaDexMetadataConfig>(DEFAULT_CONFIG);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Fetch current metadata-side config
  const { data: configData, isLoading, refetch } = trpc.nativeDownload.getMetadataConfig.useQuery();

  // Update metadata-side config mutation
  const updateConfig = trpc.nativeDownload.updateMetadataConfig.useMutation({
    onSuccess: () => {
      setSaveError(null);
      notify({ severity: 'SUCCESS', title: 'Settings Saved', message: 'MangaDex metadata settings have been updated' });
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
        preferredLanguage: configData.preferredLanguage,
        includeAdult: configData.includeAdult,
        defaultContentRating: configData.defaultContentRating
      });
    }
  }, [configData]);

  const handleSave = (): void => {
    setSaving(true);
    setSaveError(null);
    updateConfig.mutate({
      preferredLanguage: config.preferredLanguage,
      includeAdult: config.includeAdult,
      defaultContentRating: config.defaultContentRating as Array<'safe' | 'suggestive' | 'erotica' | 'pornographic'>
    });
  };

  const updateSetting = <K extends keyof MangaDexMetadataConfig>(key: K, value: MangaDexMetadataConfig[K]): void => {
    setConfig(prev => ({ ...prev, [key]: value }));
    if (saveError) setSaveError(null);
  };

  return (
    <Stack gap="md" style={{ position: 'relative' }}>
      <LoadingOverlay visible={isLoading || saving} />

      <Text size="sm" c="dimmed">
        Configure how MangaDex is used for manga metadata enrichment.
      </Text>

      {/* Language preference */}
      <Box className={classes['item']}>
        <Text size="sm" fw={500} mb={4}>Preferred Language</Text>
        <Text size="xs" c="dimmed" mb={8}>
          Preferred language for manga titles and descriptions. Shared with MangaDex chapter downloads.
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

      <Divider label="Content Filtering" labelPosition="center" />

      {/* Adult content toggle */}
      <Box className={classes['item']}>
        <SettingsSwitch
          label="Include Adult Content"
          description="Include erotica and pornographic content in search results"
          checked={config.includeAdult}
          onChange={(event) => updateSetting('includeAdult', event.currentTarget.checked)}
          disabled={isLoading || saving}
        />
      </Box>

      {/* Content rating filter */}
      <Box className={classes['item']}>
        <Text size="sm" fw={500} mb={4}>Content Rating Filter</Text>
        <Text size="xs" c="dimmed" mb={8}>
          Select which content ratings to include in search results
        </Text>
        <MultiSelect
          data={CONTENT_RATINGS}
          value={config.defaultContentRating}
          onChange={(values) => updateSetting('defaultContentRating', values)}
          disabled={isLoading || saving}
          placeholder="Select content ratings"
        />
      </Box>

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
