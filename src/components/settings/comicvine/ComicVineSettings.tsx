/**
 * Component for configuring ComicVine metadata provider settings
 *
 * This component provides a settings interface for the ComicVine metadata provider,
 * including API key management, provider enable/disable toggle, and validation.
 *
 * Uses the centralized configuration system through the useComicvineConfig hook.
 */
import React from 'react';

import { Alert, Box, Divider, Group, Stack, Switch, Text } from '@mantine/core';
import { IconBooks, IconInfoCircle } from '@tabler/icons-react';

import { ActionButtons } from './ActionButtons';
import { ApiKeySection } from './ApiKeySection';
import { FeaturesBadges } from './FeaturesBadges';
import { useComicVineForm } from './hooks/useComicVineForm';
import { InfoAlerts } from './InfoAlerts';
import { LanguageSelector } from './LanguageSelector';

/**
 * Settings component for the ComicVine metadata provider
 * Uses the new configuration system for state management
 */
export function ComicVineSettings(): React.ReactElement {
  const {
    config,
    saving,
    error,
    isLoading,
    apiKeyInput,
    validationError,
    testing,
    setApiKeyInput,
    clearValidationError,
    handleSave,
    handleTestApi,
    handleLanguageChange,
    handleToggleComicbookTracking,
  } = useComicVineForm();

  return (
    <Box>
      <Box fz="lg" fw={500} mb="md">
        ComicVine
      </Box>
      <Stack gap="md">
        <InfoAlerts
          error={error?.message ?? undefined}
          validationError={validationError ?? undefined}
        />

        <ApiKeySection
          apiKeyInput={apiKeyInput}
          onApiKeyChange={setApiKeyInput}
          validationError={validationError ?? undefined}
          onValidationErrorClear={clearValidationError}
          enabled={config.enabled}
          isLoading={isLoading}
          saving={saving ?? undefined}
        />

        <FeaturesBadges />

        <LanguageSelector
          value={config.preferredLanguage}
          onChange={(value) => {
            void handleLanguageChange(value);
          }}
          disabled={isLoading || !!saving}
        />

        <ActionButtons
          onSave={() => {
            void handleSave();
          }}
          onTestApi={() => {
            void handleTestApi();
          }}
          enabled={config.enabled}
          isLoading={isLoading}
          saving={saving ?? undefined}
          testing={testing}
          apiKeyInput={apiKeyInput}
          currentApiKey={config.apiKey}
        />

        <Divider label="Comicbook Tracking" labelPosition="left" />

        <Group justify="space-between" align="flex-start">
          <Stack gap={4} style={{ flex: 1 }}>
            <Group gap="xs">
              <IconBooks size={18} />
              <Text fw={500}>Enable Comicbook Tracking</Text>
            </Group>
            <Text size="xs" c="dimmed">
              Adds a Western comicbooks section to the library. When enabled, the
              <Text span fw={500}> Add Comic </Text>
              page becomes available and the library gains an
              <Text span fw={500}> All / Manga / Comics </Text>
              filter. Issues are fetched lazily from ComicVine the first time you
              open a comicbook series.
            </Text>
          </Stack>
          <Switch
            checked={config.comicbookTrackingEnabled}
            onChange={(e) => { void handleToggleComicbookTracking(e.currentTarget.checked); }}
            disabled={isLoading || !!saving}
            color="green"
            size="md"
            aria-label="Toggle comicbook tracking feature"
          />
        </Group>

        {config.comicbookTrackingEnabled && !config.apiKey && (
          <Alert color="yellow" icon={<IconInfoCircle size={16} />}>
            Comicbook tracking is enabled, but ComicVine has no API key yet —
            you won&apos;t be able to add new series until one is configured above.
          </Alert>
        )}
      </Stack>
    </Box>
  );
}
