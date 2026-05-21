/**
 * Library Modal Components
 *
 * Modals for creating, editing, and deleting libraries.
 * Extracted from ResponsiveLibraryList for better maintainability.
 *
 * @module components/library/LibraryModals
 */
import React, { JSX } from 'react';

import {
  Modal,
  TextInput,
  Button,
  Group,
  Stack,
  Text,
  ActionIcon
} from '@mantine/core';
import { UseFormReturnType } from '@mantine/form';
import { IconFolderPlus } from '@tabler/icons-react';

import type { LibraryWithRelations } from '@/types/search.types';

interface LibraryFormValues {
  name: string;
  path: string;
}

interface CreateLibraryModalProps {
  opened: boolean;
  onClose: () => void;
  form: UseFormReturnType<LibraryFormValues>;
  onSubmit: () => void;
  isMobile: boolean;
}

/**
 * Modal for creating a new library
 */
export function CreateLibraryModal({
  opened,
  onClose,
  form,
  onSubmit,
  isMobile
}: CreateLibraryModalProps): JSX.Element {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Add New Library"
      size={isMobile ? 'full' : 'md'}>

      <form onSubmit={form.onSubmit(onSubmit)}>
        <Stack gap="md">
          <TextInput
            label="Library Name"
            placeholder="My Manga Collection"
            required
            {...form.getInputProps('name')} />

          <TextInput
            label="Library Path"
            placeholder="/path/to/manga/folder"
            required
            {...form.getInputProps('path')}
            rightSection={
            <ActionIcon size="sm" variant="subtle">
                <IconFolderPlus size={16} />
              </ActionIcon>
            } />

          <Group justify="flex-end" gap="sm">
            <Button variant="light" onClick={onClose}>Cancel</Button>
            <Button type="submit">Create Library</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

interface EditLibraryModalProps {
  opened: boolean;
  onClose: () => void;
  form: UseFormReturnType<LibraryFormValues>;
  onSubmit: () => void;
  isMobile: boolean;
}

/**
 * Modal for editing an existing library
 */
export function EditLibraryModal({
  opened,
  onClose,
  form,
  onSubmit,
  isMobile
}: EditLibraryModalProps): JSX.Element {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Edit Library"
      size={isMobile ? 'full' : 'md'}>

      <form onSubmit={form.onSubmit(onSubmit)}>
        <Stack gap="md">
          <TextInput
            label="Library Name"
            placeholder="My Manga Collection"
            required
            {...form.getInputProps('name')} />

          <TextInput
            label="Library Path"
            placeholder="/path/to/manga/folder"
            required
            {...form.getInputProps('path')} />

          <Group justify="flex-end" gap="sm">
            <Button variant="light" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">Update Library</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

interface DeleteConfirmationModalProps {
  opened: boolean;
  onClose: () => void;
  onConfirm: () => void;
  library: LibraryWithRelations | null;
  isMobile: boolean;
}

/**
 * Modal for confirming library deletion
 */
export function DeleteConfirmationModal({
  opened,
  onClose,
  onConfirm,
  library,
  isMobile
}: DeleteConfirmationModalProps): JSX.Element {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Delete Library"
      size={isMobile ? 'full' : 'sm'}>

      <Stack gap="md">
        <Text>
          Are you sure you want to delete library <strong>{library?.name}</strong>?
          This will remove the library configuration but will not delete any files.
        </Text>
        <Group justify="flex-end" gap="sm">
          <Button variant="light" onClick={onClose}>
            Cancel
          </Button>
          <Button color="red" onClick={onConfirm}>Delete Library</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
