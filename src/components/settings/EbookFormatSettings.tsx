/**
 * Ebook Format Settings Component
 *
 * Configures support for Kindle ebook formats (MOBI, AZW3).
 * When enabled, allows importing and converting ebook files.
 *
 * @module components/settings/EbookFormatSettings
 */

import React from 'react';

import { Paper, Stack, Text, Title, Alert, Loader, List } from '@mantine/core';
import { IconBook, IconAlertCircle } from '@tabler/icons-react';

import { SettingsSwitch } from './SettingsSwitch';
import { useBooleanFormatSetting } from './useBooleanFormatSetting';

/**
 * Renders directly from the tRPC query data (no useState mirror) and uses
 * optimistic cache writes via useBooleanFormatSetting. The switch is disabled
 * while a mutation is in flight to avoid concurrent toggle races.
 *
 * @component
 */
export function EbookFormatSettings(): React.ReactElement | null {
  const { enabled, isLoading, isPending, error, toggle, clearError } = useBooleanFormatSetting(
    'media.enableEbookFormats',
    '[EbookFormatSettings]',
    'Ebook format support updated',
  );

  if (isLoading) {
    return (
      <Paper p="md" withBorder mb="xl">
        <Stack align="center" justify="center" p="xl">
          <Loader size="lg" />
          <Text size="sm" c="dimmed">Loading ebook format settings...</Text>
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper p="md" withBorder mb="xl">
      <Stack>
        <Title order={3}>Ebook Format Support</Title>
        <Text size="sm" c="dimmed" mb="md">
          Configure support for Kindle ebook formats. When enabled, you can import and convert MOBI and AZW3 files.
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
          label="Enable Ebook Formats"
          description="Enable support for Kindle formats (MOBI, AZW3). Allows importing and converting ebook files to CBZ or EPUB."
          checked={enabled}
          onChange={toggle}
          disabled={isPending}
        />

        <Alert
          icon={<IconBook size={16} />}
          title="Supported Formats"
          color="blue"
          variant="light"
          mt="md"
        >
          <Text size="sm" mb="xs">
            When enabled, the following conversions become available:
          </Text>
          <List size="sm" spacing="xs">
            <List.Item>MOBI → CBZ (Comic Book Archive)</List.Item>
            <List.Item>MOBI → EPUB (Electronic Publication)</List.Item>
            <List.Item>AZW3 → CBZ (Comic Book Archive)</List.Item>
            <List.Item>AZW3 → EPUB (Electronic Publication)</List.Item>
          </List>
          <Text size="xs" c="dimmed" mt="sm">
            Note: Only DRM-free files can be processed. DRM-protected Kindle files cannot be converted.
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
