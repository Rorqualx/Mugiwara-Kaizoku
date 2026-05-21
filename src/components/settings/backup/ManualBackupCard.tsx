import React from 'react';

import { Card, Title, Stack, Group, Text, Button, Progress } from '@mantine/core';
import { IconDownload } from '@tabler/icons-react';

interface BackupProgress {
  percentage: number;
  message: string;
  stage: string;
}

interface ManualBackupCardProps {
  onCreateBackup: () => void;
  isCreating: boolean;
  currentBackupId: string | null;
  backupProgress: BackupProgress | null;
}

export function ManualBackupCard({
  onCreateBackup,
  isCreating,
  currentBackupId,
  backupProgress
}: ManualBackupCardProps): React.ReactElement {
  return (
    <Card shadow="sm" p="lg" radius="md">
      <Title order={4} mb="md">Manual Backup</Title>

      <Stack gap="md">
        <Group justify="space-between" align="flex-end">
          <Text size="sm" c="dimmed">
            Create a backup of your database and settings
          </Text>
          <Button
            leftSection={<IconDownload />}
            onClick={onCreateBackup}
            loading={isCreating}
            disabled={currentBackupId !== null}
          >
            Create Backup Now
          </Button>
        </Group>

        {currentBackupId && backupProgress && (
          <Stack gap="xs" role="status" aria-live="polite">
            <Text size="sm" fw={500}>{backupProgress.message}</Text>
            <Progress
              value={backupProgress.percentage}
              size="md"
              striped={backupProgress.percentage < 100}
              animated={backupProgress.percentage < 100}
              aria-label={`Backup progress: ${backupProgress.percentage}%`}
              aria-valuenow={backupProgress.percentage}
              aria-valuemin={0}
              aria-valuemax={100}
              color={
                backupProgress.stage === 'failed'
                  ? 'red'
                  : backupProgress.stage === 'completed'
                    ? 'green'
                    : 'blue'
              }
            />
          </Stack>
        )}
      </Stack>
    </Card>
  );
}
