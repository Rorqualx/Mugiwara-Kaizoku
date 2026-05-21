import React, { useState, useEffect } from 'react';

import { Modal, Stack, Alert, Text, Group, Button, Progress, TextInput } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';

import type { BackupFile } from './BackupListCard';

interface RestoreModalProps {
  opened: boolean;
  onClose: () => void;
  selectedBackup: BackupFile | null;
  restoreFile: File | null;
  restoreProgress: number;
  isUploading: boolean;
  uploadProgress: { percentage: number };
  isRestoring: boolean;
  onRestore: () => void;
}

export function RestoreModal({
  opened,
  onClose,
  selectedBackup,
  restoreFile,
  restoreProgress,
  isUploading,
  uploadProgress,
  isRestoring,
  onRestore
}: RestoreModalProps): React.ReactElement {
  const [confirmText, setConfirmText] = useState('');
  const isConfirmValid = confirmText === 'RESTORE';

  // Reset confirmation input when modal closes
  useEffect(() => {
    if (!opened) {
      setConfirmText('');
    }
  }, [opened]);
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Confirm Restore"
      closeOnClickOutside={!isRestoring && !isUploading}
      closeOnEscape={!isRestoring && !isUploading}
      aria-labelledby="restore-modal-title"
      centered
    >
      <Stack gap="md" role="alertdialog" aria-describedby="restore-warning">
        <Alert id="restore-warning" icon={<IconAlertCircle />} color="red" variant="light" role="alert">
          <Text size="sm" fw={500}>This action cannot be undone!</Text>
          <Text size="sm">
            All current data will be replaced with the backup data.
          </Text>
        </Alert>

        {selectedBackup && (
          <div>
            <Text size="sm" fw={500}>Restoring from:</Text>
            <Text size="sm" c="dimmed">{selectedBackup.filename}</Text>
            <Text size="sm" c="dimmed">
              Created: {new Date(selectedBackup.createdAt).toLocaleString()}
            </Text>
          </div>
        )}

        {restoreFile && (
          <div>
            <Text size="sm" fw={500}>Restoring from file:</Text>
            <Text size="sm" c="dimmed">{restoreFile.name}</Text>
          </div>
        )}

        {restoreProgress > 0 && (
          <Progress
            value={restoreProgress}
            aria-label={`Restore progress: ${restoreProgress}%`}
            aria-valuenow={restoreProgress}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        )}

        {isUploading && (
          <div role="status" aria-live="polite">
            <Text size="sm" fw={500}>Uploading backup file...</Text>
            <Progress
              value={uploadProgress.percentage}
              aria-label={`Upload progress: ${uploadProgress.percentage}%`}
              aria-valuenow={uploadProgress.percentage}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        )}

        <TextInput
          label="Type RESTORE to confirm"
          placeholder="RESTORE"
          value={confirmText}
          onChange={(e) => setConfirmText(e.currentTarget.value)}
          error={confirmText.length > 0 && !isConfirmValid ? 'Please type RESTORE exactly' : undefined}
          disabled={isRestoring || isUploading}
        />

        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onClose} disabled={isRestoring || isUploading}>
            Cancel
          </Button>
          <Button
            color="red"
            onClick={onRestore}
            loading={isRestoring || isUploading}
            disabled={!isConfirmValid}
          >
            Restore Database
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
