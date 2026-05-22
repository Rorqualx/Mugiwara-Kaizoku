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
  onAutoDownloadChange,
  onNotificationsChange,
  onAutoMarkAsReadChange,
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
        <Button onClick={onSave}>Save Settings</Button>
      </Stack>
    </Modal>
  );
}
