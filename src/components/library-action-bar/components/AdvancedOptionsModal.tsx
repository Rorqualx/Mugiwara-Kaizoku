/**
 * AdvancedOptionsModal component for library settings
 */

import React from 'react';

import { Modal, Stack, Text, Divider, Checkbox, Button } from '@mantine/core';

import type { AdvancedOptionsModalProps } from '../types';

/**
 * Modal for configuring advanced library options including auto-download,
 * notifications, read status automation, and metadata settings.
 */
export function AdvancedOptionsModal({
  opened,
  onClose,
  autoDownloadNewChapters,
  sendUpdateNotifications,
  autoMarkAsRead,
  enableMetadataEnhancement,
  skipEmptyVolumes,
  onAutoDownloadChange,
  onNotificationsChange,
  onAutoMarkAsReadChange,
  onMetadataEnhancementChange,
  onSkipEmptyVolumesChange,
  onSave,
}: AdvancedOptionsModalProps): React.JSX.Element {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Advanced Library Options"
      size="lg"
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Configure advanced library settings and preferences.
        </Text>
        <Divider />
        <Checkbox
          label="Auto-download new chapters"
          checked={autoDownloadNewChapters}
          onChange={(event) => onAutoDownloadChange(event.currentTarget.checked)}
        />
        <Checkbox
          label="Send notifications for updates"
          checked={sendUpdateNotifications}
          onChange={(event) => onNotificationsChange(event.currentTarget.checked)}
        />
        <Checkbox
          label="Automatically mark as read when downloaded"
          checked={autoMarkAsRead}
          onChange={(event) => onAutoMarkAsReadChange(event.currentTarget.checked)}
        />
        <Checkbox
          label="Enable metadata enhancement"
          checked={enableMetadataEnhancement}
          onChange={(event) => onMetadataEnhancementChange(event.currentTarget.checked)}
        />
        <Checkbox
          label="Skip volumes without chapters"
          checked={skipEmptyVolumes}
          onChange={(event) => onSkipEmptyVolumesChange(event.currentTarget.checked)}
        />
        <Button onClick={onSave}>Save Settings</Button>
      </Stack>
    </Modal>
  );
}
