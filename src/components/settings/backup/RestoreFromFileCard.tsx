import React from 'react';

import { Card, Title, Stack, FileInput, Alert, Text, Group, Button } from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import { IconAlertCircle, IconUpload } from '@tabler/icons-react';

import { BACKUP_FILE_ACCEPT_TYPES, BACKUP_FILE_EXTENSIONS } from '@/constants/backup';

interface RestoreFromFileCardProps {
  restoreFile: File | null;
  onFileChange: (file: File | null) => void;
  onRestore: () => void;
}

export function RestoreFromFileCard({
  restoreFile,
  onFileChange,
  onRestore
}: RestoreFromFileCardProps): React.ReactElement {
  // File validation handler
  const handleFileChange = (file: File | null): void => {
    if (!file) {
      onFileChange(null);
      return;
    }

    const fileName = file.name.toLowerCase();
    const hasValidExtension = BACKUP_FILE_EXTENSIONS.some(ext => fileName.endsWith(ext));

    if (!hasValidExtension) {
      showNotification({
        title: 'Invalid File',
        message: `Please select a valid backup file (${BACKUP_FILE_EXTENSIONS.join(', ')})`,
        color: 'red',
        icon: React.createElement(IconAlertCircle, { size: 18 })
      });
      return;
    }

    onFileChange(file);
  };
  return (
    <Card shadow="sm" p="lg" radius="md">
      <Title order={4} mb="md">Restore from File</Title>

      <Stack gap="md">
        <FileInput
          label="Select backup file"
          description="Choose a backup file to restore from"
          placeholder="Choose .backup or .zip file"
          accept={BACKUP_FILE_ACCEPT_TYPES}
          value={restoreFile}
          onChange={handleFileChange}
        />

        <Alert icon={<IconAlertCircle />} color="yellow" variant="light" role="alert">
          <Text size="sm" fw={600}>Warning:</Text>
          <Text size="sm" fw={500}>
            Restoring will replace all current data. Make sure to create a backup first.
          </Text>
        </Alert>

        <Group justify="flex-end">
          <Button
            leftSection={<IconUpload />}
            onClick={onRestore}
            disabled={!restoreFile}
          >
            Restore from File
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}
