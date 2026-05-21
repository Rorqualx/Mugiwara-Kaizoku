import React, { useState } from 'react';

import { Card, Title, Group, Button, Table, Alert, Badge, ActionIcon, Modal, Stack, Text } from '@mantine/core';
import { IconRefresh, IconAlertCircle, IconUpload, IconTrash } from '@tabler/icons-react';

import { toNumberId } from '@/utils/id-converters';

export interface BackupFile {
  id: string;
  filename: string;
  size: bigint | number;
  createdAt: string;
  type: 'manual' | 'auto';
}

interface BackupListCardProps {
  backups: BackupFile[];
  onRefresh: () => void;
  onRestore: (backup: BackupFile) => void;
  onDelete: (id: number) => void;
}

function formatFileSize(bytes: bigint | number): string {
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB'];
  const numBytes = typeof bytes === 'bigint' ? Number(bytes) : bytes;
  if (numBytes === 0) return '0 Bytes';
  const i = Math.floor(Math.log(numBytes) / Math.log(1024));
  return Math.round((numBytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
}

export function BackupListCard({
  backups,
  onRefresh,
  onRestore,
  onDelete
}: BackupListCardProps): React.ReactElement {
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [backupToDelete, setBackupToDelete] = useState<BackupFile | null>(null);
  return (
    <Card shadow="sm" p="lg" radius="md">
      <Group justify="space-between" mb="md">
        <Title order={4}>Existing Backups</Title>
        <Button
          variant="subtle"
          size="xs"
          leftSection={<IconRefresh />}
          onClick={onRefresh}
        >
          Refresh
        </Button>
      </Group>

      {backups.length > 0 ? (
        <Table aria-label="List of available backups">
          <thead>
            <tr>
              <th scope="col">Filename</th>
              <th scope="col">Size</th>
              <th scope="col">Created</th>
              <th scope="col">Type</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {backups.map((backup: BackupFile) => (
              <tr key={backup.id}>
                <td>{backup.filename}</td>
                <td>{formatFileSize(backup.size)}</td>
                <td>{new Date(backup.createdAt).toLocaleString()}</td>
                <td>
                  <Badge color={backup.type === 'auto' ? 'blue' : 'green'}>
                    {backup.type}
                  </Badge>
                </td>
                <td>
                  <Group gap="xs">
                    <ActionIcon
                      color="blue"
                      aria-label="Restore from this backup"
                      title="Restore"
                      onClick={() => {
                        onRestore(backup);
                      }}
                    >
                      <IconUpload size={16} />
                    </ActionIcon>
                    <ActionIcon
                      color="red"
                      aria-label="Delete this backup"
                      title="Delete"
                      onClick={() => {
                        setBackupToDelete(backup);
                        setDeleteModalOpen(true);
                      }}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <Alert icon={<IconAlertCircle />} color="gray">
          No backups found. Create your first backup above.
        </Alert>
      )}

      <Modal
        opened={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete Backup"
        aria-labelledby="delete-modal-title"
        centered
      >
        <Stack gap="md" role="alertdialog" aria-describedby="delete-warning">
          <Text id="delete-warning">Are you sure you want to delete this backup?</Text>
          {backupToDelete && (
            <Text c="dimmed" size="sm">
              {backupToDelete.filename} ({formatFileSize(backupToDelete.size)})
            </Text>
          )}
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={() => setDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button
              color="red"
              onClick={() => {
                if (backupToDelete) {
                  onDelete(toNumberId(backupToDelete.id));
                }
                setDeleteModalOpen(false);
              }}
            >
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Card>
  );
}
