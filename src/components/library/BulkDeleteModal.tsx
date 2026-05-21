/**
 * Bulk Delete Confirmation Modal
 *
 * Provides a confirmation dialog for bulk manga deletion with optional file deletion.
 */
import React, { useState } from 'react';

import { Modal, Stack, Text, Checkbox, Group, Button, Alert, Code } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';

import { notify } from '@/utils/notify';
interface BulkDeleteModalProps {
  opened: boolean;
  onClose: () => void;
  onConfirm: (deleteFiles: boolean) => Promise<void>;
  selectedCount: number;
}

export function BulkDeleteModal({
  opened,
  onClose,
  onConfirm,
  selectedCount
}: BulkDeleteModalProps): React.ReactElement {
  const [deleteFiles, setDeleteFiles] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleConfirm = async (): Promise<void> => {
    setLoading(true);
    try {
      await onConfirm(deleteFiles);
      setDeleteFiles(false);
      onClose();
    } catch (error: unknown) {
      setDeleteFiles(false);
      notify({ severity: 'ERROR', title: 'Bulk delete failed', message: error instanceof Error ? error.message : 'An unknown error occurred' });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = (): void => {
    if (!loading) {
      setDeleteFiles(false);
      onClose();
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title="Confirm Bulk Delete"
      centered
      closeOnClickOutside={!loading}
      closeOnEscape={!loading}
    >
      <Stack gap="md">
        <Alert icon={<IconAlertTriangle />} color="red">
          You are about to delete <Code fw={700}>{selectedCount}</Code> manga from your library.
          <Text mt="xs" size="sm">
            This action cannot be undone.
          </Text>
        </Alert>

        <Checkbox
          label="Also delete downloaded files from disk"
          description="This will permanently delete all downloaded chapters and metadata"
          checked={deleteFiles}
          onChange={(e) => setDeleteFiles(e.currentTarget.checked)}
          color="red"
          disabled={loading}
        />

        <Text size="sm" c="dimmed">
          {deleteFiles
            ? 'All downloaded chapters, covers, and metadata will be permanently deleted from disk.'
            : 'Only database entries will be removed. Downloaded files will remain on disk and can be re-imported.'}
        </Text>

        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button color="red" onClick={() => void handleConfirm()} loading={loading}>
            Delete {selectedCount} Manga
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
